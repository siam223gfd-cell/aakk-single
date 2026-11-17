import type { Response, NextFunction } from 'express';
import { recordAuditLog, type AuthenticatedRequest } from '../../middleware/auth.middleware';
import { sendSuccess } from '../../utils/apiResponse';
import { orderNoteSchema, orderStatusUpdateSchema, returnUpdateSchema } from './order.admin.validation';
import {
  addOrderNoteAdmin,
  getOrderDetailAdmin,
  listOrdersAdmin,
  listPaymentTransactionsAdmin,
  listReturnsAdmin,
  transitionOrderStatusAdmin,
  updateReturnAdmin,
} from './order.admin.service';

export async function listOrdersController(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const statusGroup = String(req.query.statusGroup || '').trim();
    const data = await listOrdersAdmin({ page, limit, q, status, statusGroup });
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function getOrderController(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const data = await getOrderDetailAdmin(req.params.id);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatusController(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const parsed = orderStatusUpdateSchema.parse(req.body);
    const result = await transitionOrderStatusAdmin({
      id: req.params.id,
      ...parsed,
      actorId: req.user!._id,
      actorName: req.user!.name,
    });
    await recordAuditLog({
      actor: req.user,
      action: 'order.status_change',
      resourceType: 'Order',
      resourceId: result.orderNumber,
      summary: `Order ${result.orderNumber} transitioned ${result.prevStatus} -> ${parsed.nextStatus}`,
    });
    sendSuccess(res, { order: result.order });
  } catch (err) {
    next(err);
  }
}

export async function addOrderNoteController(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { note } = orderNoteSchema.parse(req.body);
    const order = await addOrderNoteAdmin(req.params.id, note, req.user!.name);
    sendSuccess(res, { order });
  } catch (err) {
    next(err);
  }
}

export async function listReturnsController(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const returns = await listReturnsAdmin();
    sendSuccess(res, { returns });
  } catch (err) {
    next(err);
  }
}

export async function updateReturnController(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const parsed = returnUpdateSchema.parse(req.body);
    const result = await updateReturnAdmin({
      id: req.params.id,
      ...parsed,
      actorId: req.user!._id,
      actorName: req.user!.name,
    });
    await recordAuditLog({
      actor: req.user,
      action: 'return.update',
      resourceType: 'ReturnRequest',
      resourceId: result.orderNumber,
      summary: `Updated return for ${result.orderNumber} to ${parsed.status}`,
    });
    sendSuccess(res, { returnRequest: result.returnRequest });
  } catch (err) {
    next(err);
  }
}

export async function listPaymentsController(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const transactions = await listPaymentTransactionsAdmin();
    sendSuccess(res, { transactions });
  } catch (err) {
    next(err);
  }
}
