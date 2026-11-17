import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MessageSquarePlus, Printer, Truck } from 'lucide-react';
import { AdminLayout, PermissionGuard } from '../../../layouts/AdminLayout';
import {
  AdminPageHeader,
  ErrorBanner,
  LoadingCards,
  StatusBadge,
  statusToTone,
} from '../../../components/admin/ui';
import { apiRequest } from '../../../services/api';
import { useAppDispatch } from '../../../app/hooks';
import { showToast } from '../../../features/notifications/toastSlice';
import type { OrderRecord, PaymentTransactionRecord } from '../../../types/commerce';
import { useSeoMeta } from '../../../lib/useSeoMeta';

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  useSeoMeta({ title: 'Order Detail & Invoice | NOVARA Admin', noIndex: true });
  const dispatch = useAppDispatch();

  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nextStatus, setNextStatus] = useState<'confirmed' | 'processing' | 'packed' | 'shipped' | 'delivered' | 'cancelled'>('confirmed');
  const [courierName, setCourierName] = useState('Steadfast Courier');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [reason, setReason] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{
        ok: true;
        order: OrderRecord;
        transactions: PaymentTransactionRecord[];
      }>(`/api/admin/orders/${id}`);
      setOrder(res.order);
      setTransactions(res.transactions || []);
      const s = res.order.orderStatus;
      setNextStatus(
        s === 'pending'
          ? 'confirmed'
          : s === 'confirmed'
            ? 'processing'
            : s === 'processing'
              ? 'packed'
              : s === 'packed'
                ? 'shipped'
                : 'delivered',
      );
      if (res.order.courierName) setCourierName(res.order.courierName);
      if (res.order.trackingNumber) setTrackingNumber(res.order.trackingNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load order.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handleStatusTransition = async (e: FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setUpdatingStatus(true);
    try {
      const res = await apiRequest<{ ok: true; order: OrderRecord }>(`/api/admin/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          nextStatus,
          courierName: nextStatus === 'shipped' ? courierName : undefined,
          trackingNumber: nextStatus === 'shipped' ? trackingNumber : undefined,
          reason: reason.trim() || undefined,
        }),
      });
      setOrder(res.order);
      setReason('');
      dispatch(showToast({ variant: 'success', message: `Order updated to ${nextStatus}.` }));
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Status update failed.' }));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!order || !note.trim()) return;
    setSavingNote(true);
    try {
      const res = await apiRequest<{ ok: true; order: OrderRecord }>(`/api/admin/orders/${order.id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ note: note.trim() }),
      });
      setOrder(res.order);
      setNote('');
      dispatch(showToast({ variant: 'success', message: 'Staff note added.' }));
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Note save failed.' }));
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <AdminLayout>
      <PermissionGuard permission="orders.view">
        <div className="space-y-5 max-w-[1280px] mx-auto">
          <AdminPageHeader
            title={order ? `Order ${order.orderNumber}` : 'Order Detail'}
            subtitle={order ? `Placed ${new Date(order.createdAt).toLocaleString()} by ${order.customerName}` : 'Inspect order items & fulfillment'}
            breadcrumbs={[
              { label: 'Sales & Orders' },
              { label: 'All Orders', to: '/admin/orders' },
              { label: order?.orderNumber || 'Order' },
            ]}
            actions={
              <>
                <Link
                  to="/admin/orders"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-white dark:bg-[#0B1730] px-3.5 py-2 text-xs font-semibold"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Link>
                {order && (
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#145CFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0E47D9]"
                  >
                    <Printer className="h-3.5 w-3.5" /> Print Invoice
                  </button>
                )}
              </>
            }
          />

          {error && <ErrorBanner message={error} onRetry={loadOrder} />}
          {loading ? (
            <LoadingCards count={3} />
          ) : order ? (
            <div className="grid gap-5 lg:grid-cols-3">
              {/* Main Invoice & Line Items */}
              <div className="lg:col-span-2 space-y-5">
                <div className="rounded-2xl border border-[#E4EAF5] dark:border-slate-800 bg-white dark:bg-[#0B1730] p-5 shadow-xs space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E4EAF5] dark:border-slate-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-tabular text-base font-bold text-[#101B35] dark:text-white">{order.orderNumber}</span>
                        <StatusBadge label={order.orderStatus.replace(/_/g, ' ')} tone={statusToTone(order.orderStatus)} />
                        <StatusBadge label={`Payment: ${order.paymentStatus}`} tone={statusToTone(order.paymentStatus)} />
                      </div>
                      <p className="mt-1 text-xs text-[#64748B]">
                        Method: <span className="uppercase font-semibold">{order.paymentMethod}</span>
                        {order.courierName ? ` · Courier: ${order.courierName}` : ''}
                        {order.trackingNumber ? ` · Tracking: ${order.trackingNumber}` : ''}
                      </p>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-semibold text-[#101B35] dark:text-white">{order.shippingAddress.recipientName}</div>
                      <div className="text-[#64748B]">
                        {order.shippingAddress.house}, {order.shippingAddress.area}, {order.shippingAddress.upazila},{' '}
                        {order.shippingAddress.district}, {order.shippingAddress.division}
                      </div>
                      <div className="font-mono-tabular text-[#64748B]">{order.shippingAddress.phone}</div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[#E4EAF5] dark:border-slate-800 text-[#64748B]">
                        <tr>
                          <th className="py-2 pr-3">Item & SKU</th>
                          <th className="py-2 pr-3 text-center">Qty</th>
                          <th className="py-2 pr-3 text-right">Unit Price</th>
                          <th className="py-2 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {order.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-3 pr-3">
                              <div className="font-semibold text-[#101B35] dark:text-white">{item.name}</div>
                              <div className="font-mono-tabular text-[11px] text-[#64748B]">
                                {item.sku}
                                {item.variantOptions && Object.keys(item.variantOptions).length > 0
                                  ? ` · ${Object.values(item.variantOptions).join(' / ')}`
                                  : ''}
                              </div>
                            </td>
                            <td className="py-3 pr-3 text-center font-mono-tabular">{item.quantity}</td>
                            <td className="py-3 pr-3 text-right font-mono-tabular">
                              ৳{item.unitPrice.toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 text-right font-mono-tabular font-bold">
                              ৳{item.lineTotal.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t border-[#E4EAF5] dark:border-slate-800 pt-3 flex flex-col items-end gap-1 text-xs">
                    <div className="flex w-56 justify-between text-[#64748B]">
                      <span>Subtotal</span>
                      <span className="font-mono-tabular">৳{order.subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    {order.discount > 0 && (
                      <div className="flex w-56 justify-between text-emerald-600">
                        <span>Discount {order.couponCode ? `(${order.couponCode})` : ''}</span>
                        <span className="font-mono-tabular">-৳{order.discount.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="flex w-56 justify-between text-[#64748B]">
                      <span>Shipping Charge</span>
                      <span className="font-mono-tabular">৳{order.shippingCharge.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex w-56 justify-between border-t border-[#E4EAF5] dark:border-slate-800 pt-1.5 text-sm font-bold text-[#101B35] dark:text-white">
                      <span>Grand Total</span>
                      <span className="font-mono-tabular text-[#145CFF]">৳{order.total.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Transactions & Status Timeline */}
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#E4EAF5] dark:border-slate-800 bg-white dark:bg-[#0B1730] p-5 shadow-xs space-y-3">
                    <h3 className="font-display text-sm font-bold text-[#101B35] dark:text-white">Status Timeline</h3>
                    <div className="space-y-2.5 text-xs">
                      {(order.statusHistory || []).map((h, i) => (
                        <div key={i} className="border-l-2 border-[#145CFF] pl-3">
                          <div className="font-semibold capitalize text-[#101B35] dark:text-white">
                            {h.fromStatus || 'created'} → {h.toStatus}
                          </div>
                          <div className="text-[11px] text-[#64748B]">
                            {h.actorName} · {new Date(h.timestamp).toLocaleString()}
                          </div>
                          {h.reason && <div className="text-[11px] text-[#64748B] italic">{h.reason}</div>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#E4EAF5] dark:border-slate-800 bg-white dark:bg-[#0B1730] p-5 shadow-xs space-y-3">
                    <h3 className="font-display text-sm font-bold text-[#101B35] dark:text-white">Gateway Transactions</h3>
                    {transactions.length === 0 ? (
                      <p className="text-xs text-[#64748B]">No gateway transactions recorded (e.g., Cash on Delivery).</p>
                    ) : (
                      <div className="space-y-2 text-xs">
                        {transactions.map((t) => (
                          <div key={t.id} className="rounded-xl border border-[#E4EAF5] dark:border-slate-800 p-2.5">
                            <div className="flex justify-between font-semibold">
                              <span className="uppercase">{t.gateway}</span>
                              <StatusBadge label={t.status} tone={statusToTone(t.status)} />
                            </div>
                            <div className="font-mono-tabular text-[11px] text-[#64748B] mt-1">
                              Ref: {t.transactionId} · ৳{t.amount.toLocaleString('en-IN')}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Fulfillment Transition & Staff Notes */}
              <div className="space-y-5">
                <form
                  onSubmit={handleStatusTransition}
                  className="rounded-2xl border border-[#E4EAF5] dark:border-slate-800 bg-white dark:bg-[#0B1730] p-5 shadow-xs space-y-3"
                >
                  <h3 className="font-display text-sm font-bold text-[#101B35] dark:text-white flex items-center gap-2">
                    <Truck className="h-4 w-4 text-[#145CFF]" /> Fulfillment Control
                  </h3>
                  <div>
                    <label className="mb-1 block text-xs font-semibold">Transition To</label>
                    <select
                      value={nextStatus}
                      onChange={(e) => setNextStatus(e.target.value as typeof nextStatus)}
                      className="w-full h-9 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs"
                    >
                      <option value="confirmed">Confirmed</option>
                      <option value="processing">Processing</option>
                      <option value="packed">Packed</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  {nextStatus === 'shipped' && (
                    <>
                      <div>
                        <label className="mb-1 block text-xs font-semibold">Courier Partner</label>
                        <select
                          value={courierName}
                          onChange={(e) => setCourierName(e.target.value)}
                          className="w-full h-9 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs"
                        >
                          <option value="Steadfast Courier">Steadfast Courier</option>
                          <option value="RedX Logistics">RedX Logistics</option>
                          <option value="Pathao Courier">Pathao Courier</option>
                          <option value="SA Paribahan">SA Paribahan</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold">Tracking Number *</label>
                        <input
                          required
                          value={trackingNumber}
                          onChange={(e) => setTrackingNumber(e.target.value)}
                          placeholder="TRK-..."
                          className="w-full h-9 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 font-mono-tabular text-xs"
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="mb-1 block text-xs font-semibold">Reason / Dispatch Note</label>
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full h-9 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={updatingStatus}
                    className="w-full rounded-xl bg-[#145CFF] py-2.5 text-xs font-semibold text-white hover:bg-[#0E47D9] disabled:opacity-50"
                  >
                    {updatingStatus ? 'Updating...' : 'Update Order Status'}
                  </button>
                </form>

                <div className="rounded-2xl border border-[#E4EAF5] dark:border-slate-800 bg-white dark:bg-[#0B1730] p-5 shadow-xs space-y-3">
                  <h3 className="font-display text-sm font-bold text-[#101B35] dark:text-white flex items-center gap-2">
                    <MessageSquarePlus className="h-4 w-4 text-[#145CFF]" /> Internal Staff Notes
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
                    {(order.staffNotes || []).length === 0 ? (
                      <p className="text-[#64748B]">No internal notes yet.</p>
                    ) : (
                      (order.staffNotes || []).map((n, i) => (
                        <div key={i} className="rounded-xl bg-[#F4F7FF] dark:bg-slate-900 p-2.5">
                          <div className="text-[#101B35] dark:text-slate-200">{n.note}</div>
                          <div className="mt-1 text-[10.5px] text-[#64748B]">
                            {n.actorName} · {new Date(n.timestamp).toLocaleString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <form onSubmit={handleAddNote} className="space-y-2">
                    <textarea
                      rows={2}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add internal coordination note..."
                      className="w-full rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 p-2.5 text-xs"
                    />
                    <button
                      type="submit"
                      disabled={savingNote || !note.trim()}
                      className="w-full rounded-xl border border-[#E4EAF5] dark:border-slate-700 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                    >
                      {savingNote ? 'Saving...' : 'Save Note'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}
