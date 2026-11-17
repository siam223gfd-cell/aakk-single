import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Eye, ShoppingCart, Truck } from 'lucide-react';
import { AdminLayout, PermissionGuard } from '../../../layouts/AdminLayout';
import {
  AdminPageHeader,
  DataTable,
  EmptyStateCard,
  ErrorBanner,
  SearchFilterBar,
  StatusBadge,
  statusToTone,
} from '../../../components/admin/ui';
import { Modal } from '../../../components/ui/Modal';
import { apiRequest } from '../../../services/api';
import { useAppDispatch } from '../../../app/hooks';
import { showToast } from '../../../features/notifications/toastSlice';
import type { OrderRecord } from '../../../types/commerce';
import { useSeoMeta } from '../../../lib/useSeoMeta';

export type OrderStatusGroup = '' | 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

const GROUP_TITLES: Record<OrderStatusGroup, string> = {
  '': 'All Orders',
  pending: 'Pending Orders',
  processing: 'Processing & Packed Orders',
  shipped: 'Shipped Orders',
  delivered: 'Delivered Orders',
  cancelled: 'Cancelled & Returned Orders',
};

export function OrdersListPage({ initialStatusGroup = '' }: { initialStatusGroup?: OrderStatusGroup }) {
  const pageTitle = GROUP_TITLES[initialStatusGroup] || 'Orders';
  useSeoMeta({ title: `${pageTitle} | NOVARA Admin`, noIndex: true });
  const dispatch = useAppDispatch();

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusTarget, setStatusTarget] = useState<OrderRecord | null>(null);
  const [nextStatus, setNextStatus] = useState<'confirmed' | 'processing' | 'packed' | 'shipped' | 'delivered' | 'cancelled'>('confirmed');
  const [courierName, setCourierName] = useState('Steadfast Courier');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatusFilter('');
    setPage(1);
  }, [initialStatusGroup]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('q', search.trim());
      if (statusFilter) qs.set('status', statusFilter);
      else if (initialStatusGroup) qs.set('statusGroup', initialStatusGroup);
      qs.set('page', String(page));
      qs.set('limit', '25');
      const res = await apiRequest<{
        ok: true;
        orders: OrderRecord[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`/api/admin/orders?${qs.toString()}`);
      setOrders(res.orders || []);
      if (res.pagination) setPagination(res.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load orders.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, initialStatusGroup, page]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleStatusUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!statusTarget) return;
    setSaving(true);
    try {
      const res = await apiRequest<{ ok: true; order: OrderRecord }>(`/api/admin/orders/${statusTarget.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          nextStatus,
          courierName: nextStatus === 'shipped' ? courierName : undefined,
          trackingNumber: nextStatus === 'shipped' ? trackingNumber : undefined,
          reason: statusReason || undefined,
        }),
      });
      dispatch(showToast({ variant: 'success', message: `Order ${res.order.orderNumber} updated to ${nextStatus}.` }));
      setStatusTarget(null);
      setStatusReason('');
      setTrackingNumber('');
      loadOrders();
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Transition failed.' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <PermissionGuard permission="orders.view">
        <div className="space-y-4 max-w-[1440px] mx-auto">
          <AdminPageHeader
            title={pageTitle}
            subtitle="Inspect customer orders, assign Bangladesh couriers, transition fulfillment stages, and view invoices."
            breadcrumbs={[{ label: 'Sales & Orders' }, { label: pageTitle }]}
            actions={
              <Link
                to="/admin/returns"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-white dark:bg-[#0B1730] px-3.5 py-2 text-xs font-semibold"
              >
                Returns & Refunds
              </Link>
            }
          />

          <div className="flex flex-wrap gap-1.5">
            {[
              { to: '/admin/orders', key: '', label: 'All Orders' },
              { to: '/admin/orders/pending', key: 'pending', label: 'Pending' },
              { to: '/admin/orders/processing', key: 'processing', label: 'Processing' },
              { to: '/admin/orders/shipped', key: 'shipped', label: 'Shipped' },
              { to: '/admin/orders/delivered', key: 'delivered', label: 'Delivered' },
              { to: '/admin/orders/cancelled', key: 'cancelled', label: 'Cancelled' },
            ].map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  initialStatusGroup === tab.key
                    ? 'bg-[#145CFF] text-white'
                    : 'border border-[#E4EAF5] dark:border-slate-800 bg-white dark:bg-[#0B1730] text-[#64748B] dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>

          <SearchFilterBar
            searchValue={search}
            onSearchChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            searchPlaceholder="Search order #, customer name, email, or phone..."
            filters={
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter exact order status"
                className="h-9 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs"
              >
                <option value="">All Exact Statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="packed">Packed</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
                <option value="return_requested">Return Requested</option>
                <option value="returned">Returned</option>
              </select>
            }
          />

          {error && <ErrorBanner message={error} onRetry={loadOrders} />}

          <DataTable<OrderRecord>
            rows={orders}
            rowKey={(o) => o.id}
            loading={loading}
            pagination={pagination}
            onPageChange={setPage}
            emptyState={
              <EmptyStateCard
                icon={<ShoppingCart className="h-6 w-6" />}
                title="No orders match this view"
                description="Incoming customer checkouts and payment-verified orders will appear here automatically."
              />
            }
            columns={[
              {
                key: 'order',
                header: 'Order #',
                render: (o) => (
                  <div>
                    <Link
                      to={`/admin/orders/${o.id}`}
                      className="font-mono-tabular font-bold text-[#145CFF] hover:underline"
                    >
                      {o.orderNumber}
                    </Link>
                    <div className="text-[11px] text-[#64748B]">{new Date(o.createdAt).toLocaleString()}</div>
                  </div>
                ),
              },
              {
                key: 'customer',
                header: 'Customer & Zone',
                render: (o) => (
                  <div>
                    <div className="font-semibold text-[#101B35] dark:text-white">{o.customerName}</div>
                    <div className="text-[11px] text-[#64748B]">
                      {o.shippingAddress.district}, {o.shippingAddress.division} · {o.customerPhone}
                    </div>
                  </div>
                ),
              },
              {
                key: 'payment',
                header: 'Payment',
                render: (o) => (
                  <div className="flex items-center gap-1.5">
                    <span className="uppercase font-semibold text-xs">{o.paymentMethod}</span>
                    <StatusBadge label={o.paymentStatus} tone={statusToTone(o.paymentStatus)} />
                  </div>
                ),
              },
              {
                key: 'total',
                header: 'Amount',
                render: (o) => (
                  <span className="font-mono-tabular font-bold text-[#101B35] dark:text-white">
                    ৳{o.total.toLocaleString('en-IN')}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Order Status',
                render: (o) => <StatusBadge label={o.orderStatus.replace(/_/g, ' ')} tone={statusToTone(o.orderStatus)} />,
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (o) => (
                  <div className="flex items-center justify-end gap-1.5">
                    <Link
                      to={`/admin/orders/${o.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#E4EAF5] dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-[#101B35] dark:text-slate-200 hover:bg-slate-50"
                    >
                      <Eye className="h-3.5 w-3.5 text-[#145CFF]" /> Details
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setStatusTarget(o);
                        setNextStatus(
                          o.orderStatus === 'pending'
                            ? 'confirmed'
                            : o.orderStatus === 'confirmed'
                              ? 'processing'
                              : o.orderStatus === 'processing'
                                ? 'packed'
                                : o.orderStatus === 'packed'
                                  ? 'shipped'
                                  : 'delivered',
                        );
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#145CFF] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0E47D9]"
                    >
                      <Truck className="h-3.5 w-3.5" /> Fulfill
                    </button>
                  </div>
                ),
              },
            ]}
          />

          <Modal
            open={Boolean(statusTarget)}
            onClose={() => setStatusTarget(null)}
            title={`Update Fulfillment · ${statusTarget?.orderNumber || ''}`}
            size="md"
          >
            <form onSubmit={handleStatusUpdate} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold">Next Order Status</label>
                <select
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value as typeof nextStatus)}
                  className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs"
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing</option>
                  <option value="packed">Packed</option>
                  <option value="shipped">Shipped (Dispatches Stock)</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled (Restores Reserved Stock)</option>
                </select>
              </div>
              {nextStatus === 'shipped' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold">Courier Partner</label>
                    <select
                      value={courierName}
                      onChange={(e) => setCourierName(e.target.value)}
                      className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs"
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
                      placeholder="TRK-BD-..."
                      className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 font-mono-tabular text-xs"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-semibold">Transition Reason / Note</label>
                <input
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="Optional reason saved to timeline"
                  className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStatusTarget(null)}
                  className="rounded-xl border border-[#E4EAF5] px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#145CFF] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0E47D9] disabled:opacity-50"
                >
                  {saving ? 'Updating...' : 'Apply Status'}
                </button>
              </div>
            </form>
          </Modal>
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}
