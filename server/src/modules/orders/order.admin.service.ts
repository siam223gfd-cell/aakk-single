import { OrderModel, PaymentTransactionModel } from './order.model';
import { ProductModel } from '../products/product.model';
import { InventoryMovementModel } from '../inventory/inventoryMovement.model';
import { ReturnRequestModel } from '../reviews/review.model';
import { HomepageConfigModel } from '../cms/cms.model';
import { AppError } from '../../middleware/error.middleware';
import {
  canTransitionOrderStatus,
  shouldRestoreStockOnCancel,
  type OrderStatus,
} from '../../../../src/lib/orderStateMachine';

export async function listOrdersAdmin(params: {
  page: number;
  limit: number;
  q: string;
  status: string;
  statusGroup: string;
}) {
  const { page, limit, q, status, statusGroup } = params;
  const filter: Record<string, unknown> = {};
  if (status) {
    filter.orderStatus = status;
  } else if (statusGroup) {
    const groupMap: Record<string, string[]> = {
      pending: ['pending', 'confirmed'],
      processing: ['processing', 'packed'],
      shipped: ['shipped'],
      delivered: ['delivered'],
      cancelled: ['cancelled', 'returned', 'return_requested'],
    };
    if (groupMap[statusGroup]) {
      filter.orderStatus = { $in: groupMap[statusGroup] };
    }
  }
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ orderNumber: regex }, { customerName: regex }, { customerEmail: regex }, { customerPhone: regex }];
  }

  const [total, orders] = await Promise.all([
    OrderModel.countDocuments(filter),
    OrderModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return {
    orders: orders.map((o) => ({ ...o, id: String(o._id) })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function getOrderDetailAdmin(id: string) {
  const order = await OrderModel.findById(id).lean();
  if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  const [transactions, storeConfig] = await Promise.all([
    PaymentTransactionModel.find({ orderId: order._id }).lean(),
    HomepageConfigModel.findOne({ key: 'main' }).select('storeInfo contactInfo').lean(),
  ]);
  return {
    order: { ...order, id: String(order._id) },
    transactions: transactions.map((t) => ({ ...t, id: String(t._id) })),
    storeInfo: storeConfig?.storeInfo || null,
    contactInfo: storeConfig?.contactInfo || null,
  };
}

export async function transitionOrderStatusAdmin(params: {
  id: string;
  nextStatus: 'confirmed' | 'processing' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
  reason?: string;
  courierName?: string;
  trackingNumber?: string;
  actorId: unknown;
  actorName: string;
}) {
  const order = await OrderModel.findById(params.id);
  if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');

  const check = canTransitionOrderStatus({
    currentStatus: order.orderStatus,
    nextStatus: params.nextStatus as OrderStatus,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
  });
  if (!check.allowed) {
    throw new AppError(400, 'ILLEGAL_TRANSITION', check.reason || 'Transition not allowed.');
  }

  const prevStatus = order.orderStatus;

  if (params.nextStatus === 'shipped' && prevStatus !== 'shipped') {
    for (const item of order.items) {
      if (item.variantId) {
        await ProductModel.updateOne(
          { _id: item.productId, 'variants._id': item.variantId },
          {
            $inc: {
              'variants.$.stockOnHand': -item.quantity,
              'variants.$.reservedStock': -item.quantity,
              soldCount: item.quantity,
            },
          },
        );
      } else {
        await ProductModel.updateOne(
          { _id: item.productId },
          {
            $inc: {
              stockOnHand: -item.quantity,
              reservedStock: -item.quantity,
              soldCount: item.quantity,
            },
          },
        );
      }
      await InventoryMovementModel.create({
        productId: item.productId,
        variantId: item.variantId || null,
        sku: item.sku,
        productName: item.name,
        type: 'sale',
        delta: -item.quantity,
        previousStockOnHand: 0,
        newStockOnHand: 0,
        previousReserved: item.quantity,
        newReserved: 0,
        reason: `Shipped order ${order.orderNumber}`,
        referenceId: order.orderNumber,
        actorId: params.actorId,
        actorName: params.actorName,
      }).catch(() => undefined);
    }
    order.fulfillmentStatus = 'shipped';
    if (params.courierName) order.courierName = params.courierName;
    if (params.trackingNumber) order.trackingNumber = params.trackingNumber;
  }

  if (params.nextStatus === 'packed') order.fulfillmentStatus = 'packing';
  if (params.nextStatus === 'delivered') {
    order.fulfillmentStatus = 'delivered';
    order.deliveredAt = new Date();
    if (order.paymentMethod === 'cod' && order.paymentStatus === 'unpaid') {
      order.paymentStatus = 'paid';
    }
  }

  if (params.nextStatus === 'cancelled') {
    if (shouldRestoreStockOnCancel(prevStatus, order.paymentStatus)) {
      for (const item of order.items) {
        if (item.variantId) {
          await ProductModel.updateOne(
            { _id: item.productId, 'variants._id': item.variantId },
            { $inc: { 'variants.$.reservedStock': -item.quantity } },
          );
        } else {
          await ProductModel.updateOne({ _id: item.productId }, { $inc: { reservedStock: -item.quantity } });
        }
        await InventoryMovementModel.create({
          productId: item.productId,
          variantId: item.variantId || null,
          sku: item.sku,
          productName: item.name,
          type: 'release',
          delta: item.quantity,
          previousStockOnHand: 0,
          newStockOnHand: 0,
          previousReserved: item.quantity,
          newReserved: 0,
          reason: params.reason || `Cancelled by staff (${order.orderNumber})`,
          referenceId: order.orderNumber,
          actorId: params.actorId,
          actorName: params.actorName,
        }).catch(() => undefined);
      }
    }
    order.fulfillmentStatus = 'cancelled';
    order.cancellationReason = params.reason || 'Cancelled by operations team';
  }

  order.orderStatus = params.nextStatus;
  order.statusHistory.push({
    fromStatus: prevStatus,
    toStatus: params.nextStatus,
    actorId: params.actorId as typeof order.statusHistory[0]['actorId'],
    actorName: params.actorName,
    reason: params.reason,
    timestamp: new Date(),
  });
  await order.save();

  return {
    order: { ...order.toObject(), id: String(order._id) },
    prevStatus,
    orderNumber: order.orderNumber,
  };
}

export async function addOrderNoteAdmin(id: string, note: string, actorName: string) {
  const order = await OrderModel.findById(id);
  if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  order.staffNotes.push({ note, actorName, timestamp: new Date() });
  await order.save();
  return { ...order.toObject(), id: String(order._id) };
}

export async function listReturnsAdmin() {
  const returns = await ReturnRequestModel.find().sort({ createdAt: -1 }).lean();
  return returns.map((r) => ({ ...r, id: String(r._id) }));
}

export async function updateReturnAdmin(params: {
  id: string;
  status: 'approved' | 'rejected' | 'received' | 'refunded';
  inspectionNotes?: string;
  restockEligible: boolean;
  actorId: unknown;
  actorName: string;
}) {
  const ret = await ReturnRequestModel.findById(params.id);
  if (!ret) throw new AppError(404, 'RETURN_NOT_FOUND', 'Return request not found.');

  ret.status = params.status;
  if (params.inspectionNotes) ret.inspectionNotes = params.inspectionNotes;
  ret.handledBy = params.actorId as typeof ret.handledBy;

  if (params.status === 'received' && params.restockEligible && !ret.restocked) {
    for (const item of ret.items) {
      await ProductModel.updateOne({ _id: item.productId }, { $inc: { stockOnHand: item.quantity } });
      await InventoryMovementModel.create({
        productId: item.productId,
        sku: item.sku,
        productName: item.name,
        type: 'return',
        delta: item.quantity,
        previousStockOnHand: 0,
        newStockOnHand: 0,
        previousReserved: 0,
        newReserved: 0,
        reason: `Restocked after return inspection (${ret.orderNumber})`,
        referenceId: ret.orderNumber,
        actorId: params.actorId,
        actorName: params.actorName,
      }).catch(() => undefined);
    }
    ret.restocked = true;
  }

  if (params.status === 'refunded') {
    await OrderModel.updateOne(
      { _id: ret.orderId },
      { $set: { orderStatus: 'returned', paymentStatus: 'refunded', fulfillmentStatus: 'returned' } },
    );
    await PaymentTransactionModel.updateOne(
      { orderId: ret.orderId, status: 'paid' },
      { $set: { status: 'refunded', refundedAmount: ret.refundAmount } },
    );
  }

  await ret.save();
  return { returnRequest: { ...ret.toObject(), id: String(ret._id) }, orderNumber: ret.orderNumber };
}

export async function listPaymentTransactionsAdmin() {
  const transactions = await PaymentTransactionModel.find().sort({ createdAt: -1 }).limit(100).lean();
  return transactions.map((t) => ({ ...t, id: String(t._id) }));
}
