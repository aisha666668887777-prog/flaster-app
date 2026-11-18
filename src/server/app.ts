import express from 'express';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import authRoutes from './authRoutes.ts';
import orderRoutes from './orderRoutes.ts';
import deliveryRoutes from './deliveryRoutes.ts';
import financeRoutes from './financeRoutes.ts';
import paymentRoutes from './paymentRoutes.ts';
import loyaltyRoutes from './loyaltyRoutes.ts';
import regionRoutes from './regionRoutes.ts';
import categoryRoutes from './categoryRoutes.ts';
import whatsappBotRoutes from './whatsappBotRoutes.ts';
import { getPilotReadinessReport, PILOT_STORES_RAK } from './pilotConfig.ts';

export interface RequestWithRawBody extends express.Request {
  rawBody?: string;
}

const ALLOWED_STATIC_ORIGINS = new Set<string>([
  'https://flaster.ae',
  'https://www.flaster.ae',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // Same-origin / server-to-server / curl
  if (ALLOWED_STATIC_ORIGINS.has(origin)) return true;
  const appUrl = (process.env.APP_URL || '').trim().replace(/\/$/, '');
  if (appUrl && origin === appUrl) return true;
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase();
    if (
      host.endsWith('.flaster.ae') ||
      host.endsWith('.run.app') ||
      host.endsWith('.ai.studio') ||
      host.endsWith('.aistudio.google.com') ||
      host.endsWith('.googleusercontent.com') ||
      host === 'localhost' ||
      host === '127.0.0.1'
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function createServer() {
  const app = express();

  // Capture raw request payload bytes for cryptographic HMAC webhook signature verification
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as RequestWithRawBody).rawBody = buf.toString('utf8');
      },
    })
  );

  // Security headers + strict origin-checked CORS
  app.use((req, res, next) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
    if (origin && isOriginAllowed(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else if (origin && !isOriginAllowed(origin)) {
      if (req.method === 'OPTIONS') {
        return res.status(403).json({ success: false, error: 'CORS origin not allowed' });
      }
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, x-portal-token, x-customer-id'
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Mount WhatsApp Webhook & Auto-Reply Bot routes
  app.use('/api/webhook', whatsappBotRoutes);

  // Mount Auth verification and security routes
  app.use('/api/auth', authRoutes);

  // Mount Order lifecycle and pickup verification routes
  app.use('/api/orders', orderRoutes);

  // Mount Direct Restaurant Self-Delivery routes
  app.use('/api/delivery', deliveryRoutes);

  // Mount Financial Accounting & Commission routes
  app.use('/api/finance', financeRoutes);

  // Mount Payment Gateway & Idempotency routes
  app.use('/api/payments', paymentRoutes);

  // Direct alias for Ziina Webhook (https://flaster.ae/api/ziina/webhook) as instructed by Ziina support
  app.post('/api/ziina/webhook', (req, res, next) => {
    req.url = '/ziina-webhook';
    paymentRoutes(req, res, next);
  });

  // Mount Updated Unified Loyalty Points System
  app.use('/api/loyalty', loyaltyRoutes);

  // Mount Dynamic Locations & Regions
  app.use('/api/regions', regionRoutes);

  // Mount Dynamic Core Application Categories
  app.use('/api/categories', categoryRoutes);

  // Mount Pilot Launch & Readiness routes (Al Sharisha)
  app.get('/api/pilot/readiness', (_req, res) => {
    res.json({ success: true, report: getPilotReadinessReport() });
  });

  app.get('/api/pilot/stores', (_req, res) => {
    res.json({ success: true, stores: PILOT_STORES_RAK });
  });

  // Explicit XML sitemap route for SEO / Search Console
  app.get('/sitemap.xml', (_req, res) => {
    const sitemapPath = path.resolve(process.cwd(), 'public', 'sitemap.xml');
    if (fs.existsSync(sitemapPath)) {
      res.setHeader('Content-Type', 'application/xml');
      return res.sendFile(sitemapPath);
    }
    const distSitemap = path.resolve(process.cwd(), 'dist', 'sitemap.xml');
    if (fs.existsSync(distSitemap)) {
      res.setHeader('Content-Type', 'application/xml');
      return res.sendFile(distSitemap);
    }
    res.status(404).send('Sitemap not found');
  });

  // Explicit robots.txt route
  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain');
    res.send(`User-agent: *\nAllow: /\nSitemap: https://flaster.ae/sitemap.xml\n`);
  });

  // Explicit Google Search Console verification HTML route
  app.get('/google58d11c75599fce9c.html', (_req, res) => {
    const vPath = path.resolve(process.cwd(), 'public', 'google58d11c75599fce9c.html');
    if (fs.existsSync(vPath)) {
      res.setHeader('Content-Type', 'text/html');
      return res.sendFile(vPath);
    }
    const distVPath = path.resolve(process.cwd(), 'dist', 'google58d11c75599fce9c.html');
    if (fs.existsSync(distVPath)) {
      res.setHeader('Content-Type', 'text/html');
      return res.sendFile(distVPath);
    }
    res.status(404).send('Verification file not found');
  });

  return app;
}
