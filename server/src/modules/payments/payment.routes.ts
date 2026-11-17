import { Router, type Request, type Response, type NextFunction } from 'express';
import { OrderModel, PaymentTransactionModel } from '../orders/order.model';
import { ProductModel } from '../products/product.model';
import { InventoryMovementModel } from '../inventory/inventoryMovement.model';
import { requireDatabase } from '../../database/connection';
import { validateSslCommerzTransaction } from '../../services/payment.service';
import { sendTransactionalEmail } from '../../services/email.service';
import { env } from '../../config/env';

const router = Router();

async function releaseOrderReservation(order: InstanceType<typeof OrderModel>, reason: string) {
  for (const item of order.items) {
    if (item.variantId) {
      await ProductModel.updateOne(
        { _id: item.productId, 'variants._id': item.variantId },
        { $inc: { 'variants.$.reservedStock': -item.quantity } },
      ).catch(() => undefined);
    } else {
      await ProductModel.updateOne(
        { _id: item.productId },
        { $inc: { reservedStock: -item.quantity } },
      ).catch(() => undefined);
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
      reason,
      referenceId: order.orderNumber,
    }).catch(() => undefined);
  }
}

// Verified IPN / Success Callback handler (idempotent)
async function handleGatewayVerification(tranId: string, valId: string, payload: Record<string, unknown>) {
  const tx = await PaymentTransactionModel.findOne({ transactionId: tranId });
  if (!tx) return { status: 'not_found' as const };

  // Idempotent guard: already verified as paid
  if (tx.status === 'paid') {
    return { status: 'already_paid' as const, orderNumber: tx.orderNumber };
  }

  const verification = await validateSslCommerzTransaction(valId);
  const order = await OrderModel.findById(tx.orderId);
  if (!order) return { status: 'not_found' as const };

  if (!verification.verified || Math.abs((verification.amount || 0) - tx.amount) > 1) {
    tx.status = 'failed';
    tx.rawPayload = payload;
    await tx.save();

    if (order.paymentStatus !== 'paid' && order.orderStatus === 'pending') {
      order.paymentStatus = 'failed';
      order.orderStatus = 'cancelled';
      order.cancellationReason = 'Gateway payment verification failed or amount mismatch';
      await releaseOrderReservation(order, 'Payment verification failed');
      order.statusHistory.push({
        fromStatus: 'pending',
        toStatus: 'cancelled',
        actorName: 'Payment Gateway',
        reason: 'Payment verification failed',
        timestamp: new Date(),
      });
      await order.save();
    }
    return { status: 'failed' as const, orderNumber: order.orderNumber };
  }

  tx.status = 'paid';
  tx.gatewayValidationId = valId;
  tx.bankTransactionId = verification.bankTranId;
  tx.verifiedAt = new Date();
  tx.rawPayload = verification.raw || payload;
  await tx.save();

  order.paymentStatus = 'paid';
  if (order.orderStatus === 'pending') {
    order.orderStatus = 'confirmed';
    order.statusHistory.push({
      fromStatus: 'pending',
      toStatus: 'confirmed',
      actorName: 'Payment Gateway',
      reason: `Verified payment ${tranId}`,
      timestamp: new Date(),
    });
  }
  await order.save();

  await sendTransactionalEmail({
    to: order.customerEmail,
    template: 'payment_confirmed',
    subject: `Payment Received for Order ${order.orderNumber}`,
    html: `<p>Your payment of <strong>৳${order.total.toLocaleString()}</strong> for order <strong>${order.orderNumber}</strong> has been verified.</p>`,
  });

  return { status: 'paid' as const, orderNumber: order.orderNumber };
}

router.post('/ipn', requireDatabase, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tranId = String(req.body.tran_id || '');
    const valId = String(req.body.val_id || '');
    if (!tranId || !valId) {
      res.status(400).json({ ok: false, error: 'Missing tran_id or val_id' });
      return;
    }
    const result = await handleGatewayVerification(tranId, valId, req.body);
    res.json({ ok: true, result });
  } catch (err) {
    next(err);
  }
});

router.post('/callback/success', requireDatabase, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tranId = String(req.body.tran_id || req.query.tran_id || '');
    const valId = String(req.body.val_id || req.query.val_id || '');
    const result =
      tranId && valId
        ? await handleGatewayVerification(tranId, valId, req.body)
        : { status: 'failed' as const, orderNumber: '' };
    if (result.status === 'paid' || result.status === 'already_paid') {
      res.redirect(`${env.CLIENT_URL}/account/orders?payment=success&order=${encodeURIComponent(result.orderNumber || '')}`);
      return;
    }
    res.redirect(`${env.CLIENT_URL}/account/orders?payment=failed`);
  } catch (err) {
    next(err);
  }
});

router.post('/callback/fail', requireDatabase, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tranId = String(req.body.tran_id || req.query.tran_id || '');
    if (tranId) {
      const tx = await PaymentTransactionModel.findOne({ transactionId: tranId });
      if (tx && tx.status === 'initiated') {
        tx.status = 'failed';
        tx.rawPayload = req.body;
        await tx.save();
        const order = await OrderModel.findById(tx.orderId);
        if (order && order.orderStatus === 'pending') {
          order.paymentStatus = 'failed';
          order.orderStatus = 'cancelled';
          order.cancellationReason = 'Payment failed at gateway';
          await releaseOrderReservation(order, 'Payment failed');
          await order.save();
        }
      }
    }
    res.redirect(`${env.CLIENT_URL}/account/orders?payment=failed`);
  } catch (err) {
    next(err);
  }
});

router.post('/callback/cancel', requireDatabase, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tranId = String(req.body.tran_id || req.query.tran_id || '');
    if (tranId) {
      const tx = await PaymentTransactionModel.findOne({ transactionId: tranId });
      if (tx && tx.status === 'initiated') {
        tx.status = 'cancelled';
        await tx.save();
        const order = await OrderModel.findById(tx.orderId);
        if (order && order.orderStatus === 'pending') {
          order.paymentStatus = 'cancelled';
          order.orderStatus = 'cancelled';
          order.cancellationReason = 'Payment cancelled by customer';
          await releaseOrderReservation(order, 'Payment cancelled');
          await order.save();
        }
      }
    }
    res.redirect(`${env.CLIENT_URL}/cart?payment=cancelled`);
  } catch (err) {
    next(err);
  }
});

export default router;
