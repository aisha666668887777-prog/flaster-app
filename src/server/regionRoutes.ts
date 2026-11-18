import express from 'express';
import { getAllRegions, getActiveRegions, getRegionById, addOrUpdateRegion } from './regionService.ts';

const router = express.Router();

/**
 * 1. GET /api/regions
 * Returns all active business coverage regions dynamically
 */
router.get('/', (req, res) => {
  const regions = getActiveRegions();
  return res.json({ success: true, count: regions.length, regions });
});

/**
 * 2. GET /api/regions/all
 * Returns all regions including upcoming ones
 */
router.get('/all', (req, res) => {
  const regions = getAllRegions();
  return res.json({ success: true, count: regions.length, regions });
});

/**
 * 3. GET /api/regions/:id
 * Returns a specific region by id
 */
router.get('/:id', (req, res) => {
  const region = getRegionById(req.params.id);
  if (!region) {
    return res.status(404).json({ success: false, error: 'المنطقة غير موجودة' });
  }
  return res.json({ success: true, region });
});

/**
 * 4. POST /api/regions
 * Admin endpoint to dynamically add or update a region
 */
router.post('/', (req, res) => {
  const { id, name, nameAr, city, cityAr, isPilotActive, activeMerchantsCount, deliveryAvailable, pickupAvailable, coordinates, displayOrder } = req.body;

  if (!id || !name || !nameAr) {
    return res.status(400).json({ success: false, error: 'معرف المنطقة والاسم مطلوبان' });
  }

  const updated = addOrUpdateRegion({
    id,
    name,
    nameAr,
    city: city || 'Ras Al Khaimah',
    cityAr: cityAr || 'رأس الخيمة',
    isPilotActive: isPilotActive !== undefined ? Boolean(isPilotActive) : true,
    activeMerchantsCount: activeMerchantsCount || 0,
    deliveryAvailable: deliveryAvailable !== undefined ? Boolean(deliveryAvailable) : true,
    pickupAvailable: pickupAvailable !== undefined ? Boolean(pickupAvailable) : true,
    coordinates: coordinates || { lat: 25.7925, lng: 55.9555 },
    displayOrder: displayOrder || 99
  });

  return res.status(201).json({ success: true, region: updated });
});

export default router;
