import { Router } from 'express';
import { requireDatabase } from '../../database/connection';
import { authenticateRequired, requirePermission } from '../../middleware/auth.middleware';
import {
  addOrderNoteController,
  getOrderController,
  listOrdersController,
  listPaymentsController,
  listReturnsController,
  updateOrderStatusController,
  updateReturnController,
} from './order.admin.controller';

const router = Router();
router.use(requireDatabase, authenticateRequired);

router.get('/orders', requirePermission('orders.view'), listOrdersController);
router.get('/orders/:id', requirePermission('orders.view'), getOrderController);
router.patch('/orders/:id/status', requirePermission('orders.manage_fulfillment'), updateOrderStatusController);
router.post('/orders/:id/notes', requirePermission('orders.view'), addOrderNoteController);

router.get('/returns', requirePermission('orders.view'), listReturnsController);
router.patch('/returns/:id', requirePermission('refunds.manage'), updateReturnController);

router.get('/payments', requirePermission('payments.view'), listPaymentsController);

export default router;
