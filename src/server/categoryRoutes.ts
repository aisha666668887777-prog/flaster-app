import express from 'express';
import { getAllCategories, getActiveCategories, getCategoryById, addOrUpdateCategory } from './categoryService.ts';

const router = express.Router();

/**
 * 1. GET /api/categories
 * Returns active business categories dynamically
 */
router.get('/', (req, res) => {
  const categories = getActiveCategories();
  return res.json({ success: true, count: categories.length, categories });
});

/**
 * 2. GET /api/categories/all
 * Returns all categories including inactive ones
 */
router.get('/all', (req, res) => {
  const categories = getAllCategories();
  return res.json({ success: true, count: categories.length, categories });
});

/**
 * 3. GET /api/categories/:id
 * Returns a specific category
 */
router.get('/:id', (req, res) => {
  const category = getCategoryById(req.params.id);
  if (!category) {
    return res.status(404).json({ success: false, error: 'التصنيف غير موجود' });
  }
  return res.json({ success: true, category });
});

/**
 * 4. POST /api/categories
 * Admin endpoint to dynamically create or update a business category
 */
router.post('/', (req, res) => {
  const { id, name, nameAr, descriptionEn, descriptionAr, icon, displayOrder, isActive, merchantCount } = req.body;

  if (!id || !name || !nameAr) {
    return res.status(400).json({ success: false, error: 'معرف التصنيف واسم التصنيف مطلوبان' });
  }

  const updated = addOrUpdateCategory({
    id,
    name,
    nameAr,
    descriptionEn: descriptionEn || '',
    descriptionAr: descriptionAr || '',
    icon: icon || 'sparkles',
    displayOrder: displayOrder || 99,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    merchantCount: merchantCount || 0
  });

  return res.status(201).json({ success: true, category: updated });
});

export default router;
