export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'return_requested'
  | 'returned';

export type PaymentStatus =
  | 'unpaid'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refund_pending'
  | 'refunded';

export type FulfillmentStatus =
  | 'unfulfilled'
  | 'packing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['return_requested'],
  return_requested: ['returned', 'delivered'],
  returned: [],
  cancelled: [],
};

export function canTransitionOrderStatus(params: {
  currentStatus: OrderStatus;
  nextStatus: OrderStatus;
  paymentMethod: 'cod' | 'sslcommerz' | 'bkash' | 'card';
  paymentStatus: PaymentStatus;
}): { allowed: boolean; reason?: string } {
  if (params.currentStatus === params.nextStatus) {
    return { allowed: false, reason: `Order is already ${params.currentStatus}.` };
  }

  const allowedNext = ORDER_TRANSITIONS[params.currentStatus] || [];
  if (!allowedNext.includes(params.nextStatus)) {
    return {
      allowed: false,
      reason: `Cannot transition order from "${params.currentStatus}" to "${params.nextStatus}".`,
    };
  }

  // Online prepaid orders must be paid before packing or shipping
  if (
    params.paymentMethod !== 'cod' &&
    (params.nextStatus === 'processing' || params.nextStatus === 'packed' || params.nextStatus === 'shipped') &&
    params.paymentStatus !== 'paid'
  ) {
    return {
      allowed: false,
      reason: 'Online payment must be verified as paid before processing or shipping.',
    };
  }

  return { allowed: true };
}

export function canCustomerCancelOrder(status: OrderStatus): boolean {
  return status === 'pending' || status === 'confirmed';
}

export function canCustomerRequestReturn(status: OrderStatus, deliveredAt?: Date | string | null, now: Date = new Date()): boolean {
  if (status !== 'delivered') return false;
  if (!deliveredAt) return true;
  const elapsedMs = now.getTime() - new Date(deliveredAt).getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return elapsedMs <= sevenDaysMs;
}

export function computeAvailableStock(stockOnHand: number, reservedStock: number): number {
  return Math.max(0, Math.floor(stockOnHand) - Math.floor(reservedStock));
}

export function shouldRestoreStockOnCancel(
  previousStatus: OrderStatus,
  paymentStatus: PaymentStatus,
): boolean {
  // Stock was reserved when order was created unless payment already failed/cancelled before reservation or already shipped/returned
  if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
    return false;
  }
  return ['pending', 'confirmed', 'processing', 'packed'].includes(previousStatus);
}
