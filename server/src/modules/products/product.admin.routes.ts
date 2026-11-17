import { Router } from 'express';
import multer from 'multer';
import { requireDatabase } from '../../database/connection';
import { authenticateRequired, requirePermission } from '../../middleware/auth.middleware';
import {
  bulkImportProductsController,
  bulkProductActionController,
  createAttributeController,
  createProductController,
  deleteAttributeController,
  deleteProductController,
  duplicateProductController,
  exportProductsController,
  getProductController,
  listAttributesController,
  listProductsController,
  mediaUploadController,
  updateAttributeController,
  updateProductController,
  updateProductStatusController,
} from './product.controller';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.use(requireDatabase, authenticateRequired);

router.post('/media/upload', requirePermission('catalog.manage'), upload.single('file'), mediaUploadController);

// Note: bulk routes registered before :id parameter routes
router.get('/products/bulk/export', requirePermission('catalog.view'), exportProductsController);
router.post('/products/bulk/import', requirePermission('catalog.manage'), bulkImportProductsController);
router.post('/products/bulk/action', requirePermission('catalog.manage'), bulkProductActionController);

router.get('/products', requirePermission('catalog.view'), listProductsController);
router.get('/products/:id', requirePermission('catalog.view'), getProductController);
router.post('/products', requirePermission('catalog.manage'), createProductController);
router.put('/products/:id', requirePermission('catalog.manage'), updateProductController);
router.patch('/products/:id/status', requirePermission('catalog.manage'), updateProductStatusController);
router.post('/products/:id/duplicate', requirePermission('catalog.manage'), duplicateProductController);
router.delete('/products/:id', requirePermission('catalog.manage'), deleteProductController);

router.get('/attributes', requirePermission('catalog.view'), listAttributesController);
router.post('/attributes', requirePermission('catalog.manage'), createAttributeController);
router.put('/attributes/:id', requirePermission('catalog.manage'), updateAttributeController);
router.delete('/attributes/:id', requirePermission('catalog.manage'), deleteAttributeController);

export default router;
