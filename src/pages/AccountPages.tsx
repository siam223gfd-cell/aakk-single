import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Heart,
  Lock,
  MapPin,
  Package,
  Plus,
  RotateCcw,
  Trash2,
  User,
  XCircle,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { openAuthModal, setUserProfile } from '../features/auth/authSlice';
import { showToast } from '../features/notifications/toastSlice';
import { apiRequest } from '../services/api';
import type { OrderRecord, ProductItem, SavedAddress, UserProfile } from '../types/commerce';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { ResilientImage } from '../components/ui/ResilientImage';
import { ProductCard } from '../components/catalog/ProductCard';
import { canCustomerCancelOrder, canCustomerRequestReturn } from '../lib/orderStateMachine';
import {
  getAreasForUpazila,
  getDistrictsForDivision,
  getDivisionNames,
  getUpazilasForDistrict,
} from '../lib/bdLocations';
import { useSeoMeta } from '../lib/useSeoMeta';

function AccountAuthGate({ title }: { title: string }) {
  const dispatch = useAppDispatch();
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <Lock className="mx-auto h-12 w-12 text-[#1155EE]" />
      <h1 className="font-display mt-4 text-2xl font-bold text-[#0F1D3A]">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">Sign in to view your account, orders, and saved addresses.</p>
      <button
        type="button"
        onClick={() => dispatch(openAuthModal({ tab: 'login', returnUrl: window.location.pathname }))}
        className="mt-6 rounded-full bg-[#1155EE] px-7 py-2.5 text-sm font-semibold text-white"
      >
        Sign In / Register
      </button>
    </div>
  );
}

export function AccountProfilePage() {
  useSeoMeta({ title: 'My Account | NOVARA COMMERCE', noIndex: true });
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [promotions, setPromotions] = useState(false);
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setPhone(user.phone || '');
    setOrderUpdates(user.notificationPrefs?.orderUpdates ?? true);
    setPromotions(user.notificationPrefs?.promotions ?? false);
  }, [user]);

  if (!user) return <AccountAuthGate title="My Account & Settings" />;

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiRequest<{ ok: true; user: UserProfile }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          phone,
          notificationPrefs: { orderUpdates, promotions, backInStock: true },
        }),
      });
      dispatch(setUserProfile(res.user));
      dispatch(showToast({ variant: 'success', message: 'Profile and preferences updated.' }));
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Update failed' }));
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ ok: true; message: string }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      dispatch(showToast({ variant: 'success', message: res.message }));
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Password change failed' }));
    }
  };

  return (
    <div className="mx-auto max-w-[1140px] px-4 py-8">
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        <Link to="/account" className="rounded-lg bg-[#1155EE] px-4 py-2 text-xs font-semibold text-white">Profile</Link>
        <Link to="/account/orders" className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-200">My Orders</Link>
        <Link to="/account/addresses" className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-200">Saved Addresses</Link>
        <Link to="/wishlist" className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-200">Wishlist</Link>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <form onSubmit={handleSaveProfile} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-[#1155EE]" />
            <h1 className="font-display text-lg font-bold text-[#0F1D3A]">Profile Information</h1>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Email</label>
            <input type="email" disabled value={user.email} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Full Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Phone Number</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={orderUpdates} onChange={(e) => setOrderUpdates(e.target.checked)} />
              Receive order status &amp; delivery email updates
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={promotions} onChange={(e) => setPromotions(e.target.checked)} />
              Receive promotional campaigns &amp; offers
            </label>
          </div>
          <button type="submit" disabled={saving} className="rounded-xl bg-[#1155EE] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0B44CC]">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>

        <form onSubmit={handlePasswordChange} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 self-start">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-[#1155EE]" />
            <h2 className="font-display text-lg font-bold text-[#0F1D3A]">Password &amp; Security</h2>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Current Password</label>
            <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">New Password (min 8 chars)</label>
            <input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="rounded-xl border border-[#1155EE] px-5 py-2.5 text-sm font-semibold text-[#1155EE] hover:bg-[#E9F0FD]">
            Update Password
          </button>
        </form>
      </div>
    </div>
  );
}

export function OrderHistoryPage() {
  useSeoMeta({ title: 'My Orders | NOVARA COMMERCE', noIndex: true });
  const { user } = useAppSelector((s) => s.auth);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    apiRequest<{ ok: true; orders: OrderRecord[] }>('/api/orders/my')
      .then((res) => setOrders(res.orders))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return <AccountAuthGate title="My Order History" />;

  return (
    <div className="mx-auto max-w-[1140px] px-4 py-8">
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        <Link to="/account" className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-200">Profile</Link>
        <Link to="/account/orders" className="rounded-lg bg-[#1155EE] px-4 py-2 text-xs font-semibold text-white">My Orders</Link>
        <Link to="/account/addresses" className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-200">Saved Addresses</Link>
        <Link to="/wishlist" className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-200">Wishlist</Link>
      </div>

      <h1 className="font-display mb-5 text-2xl font-bold text-[#0F1D3A]">Order History</h1>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <Package className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 font-display text-lg font-bold text-[#0F1D3A]">No orders placed yet</p>
          <Link to="/shop" className="mt-4 inline-block rounded-full bg-[#1155EE] px-6 py-2 text-xs font-semibold text-white">
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <span className="font-mono-tabular text-sm font-bold text-[#0F1D3A]">{order.orderNumber}</span>
                  <span className="ml-3 text-xs text-slate-500">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                  <span className="uppercase text-slate-600">Payment: {order.paymentStatus}</span>
                  <span aria-hidden="true">·</span>
                  <span className="uppercase text-[#1155EE]">Status: {order.orderStatus.replace('_', ' ')}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {order.items.slice(0, 3).map((it, idx) => (
                      <div key={idx} className="h-12 w-12 overflow-hidden rounded-lg border border-slate-200 bg-white p-1">
                        <ResilientImage src={it.imageUrl} alt={it.name} />
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-slate-600">
                    <p className="font-semibold text-[#0F1D3A]">
                      {order.items[0]?.name}
                      {order.items.length > 1 ? ` + ${order.items.length - 1} more item(s)` : ''}
                    </p>
                    <p>Total: <strong className="font-mono-tabular text-[#1155EE]">৳{order.total.toLocaleString()}</strong></p>
                  </div>
                </div>
                <Link
                  to={`/account/orders/${order.id}`}
                  className="rounded-xl border border-[#1155EE] px-4 py-2 text-xs font-semibold text-[#1155EE] hover:bg-[#E9F0FD]"
                >
                  View Order Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function OrderDetailPage() {
  useSeoMeta({ title: 'Order Details | NOVARA COMMERCE', noIndex: true });
  const { id } = useParams();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);

  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnDetails, setReturnDetails] = useState('');

  const loadOrder = () => {
    if (!id || !user) return;
    setLoading(true);
    apiRequest<{ ok: true; order: OrderRecord }>(`/api/orders/${id}`)
      .then((res) => setOrder(res.order))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrder();
  }, [id, user]);

  if (!user) return <AccountAuthGate title="Order Details" />;
  if (loading) return <div className="mx-auto max-w-4xl px-4 py-12 text-sm text-slate-500">Loading order...</div>;
  if (!order) return <div className="mx-auto max-w-4xl px-4 py-12 text-sm text-rose-600">Order not found.</div>;

  const handleCancelOrder = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ ok: true; order: OrderRecord }>(`/api/orders/${order.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason }),
      });
      setOrder(res.order);
      setCancelModalOpen(false);
      dispatch(showToast({ variant: 'info', message: 'Order cancelled and reserved stock released.' }));
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Unable to cancel order' }));
    }
  };

  const handleReturnSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest(`/api/orders/${order.id}/return`, {
        method: 'POST',
        body: JSON.stringify({ reason: returnReason, details: returnDetails }),
      });
      setReturnModalOpen(false);
      loadOrder();
      dispatch(showToast({ variant: 'success', message: 'Return request submitted for inspection.' }));
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Return request failed' }));
    }
  };

  return (
    <div className="mx-auto max-w-[1140px] px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/account/orders" className="text-xs font-semibold text-[#1155EE] hover:underline">
            ← Back to Orders
          </Link>
          <h1 className="font-display mt-1 text-2xl font-bold text-[#0F1D3A]">
            Order <span className="font-mono-tabular">{order.orderNumber}</span>
          </h1>
          <p className="text-xs text-slate-500">Placed on {new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCustomerCancelOrder(order.orderStatus) && (
            <button
              type="button"
              onClick={() => setCancelModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
            >
              <XCircle className="h-4 w-4" /> Cancel Order
            </button>
          )}
          {canCustomerRequestReturn(order.orderStatus, order.deliveredAt) && (
            <button
              type="button"
              onClick={() => setReturnModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50"
            >
              <RotateCcw className="h-4 w-4" /> Request Return
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-display mb-4 text-base font-bold text-[#0F1D3A]">Items</h2>
            <ul className="divide-y divide-slate-100">
              {order.items.map((item, idx) => (
                <li key={idx} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-lg border border-slate-200 bg-white p-1">
                      <ResilientImage src={item.imageUrl} alt={item.name} />
                    </div>
                    <div>
                      <Link to={`/product/${item.slug}`} className="text-sm font-semibold text-[#0F1D3A] hover:text-[#1155EE]">
                        {item.name}
                      </Link>
                      <p className="font-mono-tabular text-xs text-slate-500">
                        SKU: {item.sku} · Qty: {item.quantity} × ৳{item.unitPrice.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono-tabular text-sm font-bold text-[#0F1D3A]">
                    ৳{item.lineTotal.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-display mb-4 text-base font-bold text-[#0F1D3A]">Status Timeline</h2>
            <ul className="space-y-3">
              {order.statusHistory.map((step, idx) => (
                <li key={idx} className="flex items-start gap-3 text-xs">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1155EE]" />
                  <div>
                    <p className="font-semibold uppercase text-[#0F1D3A]">{step.toStatus.replace('_', ' ')}</p>
                    {step.reason && <p className="text-slate-600">{step.reason}</p>}
                    <p className="text-slate-400">
                      {new Date(step.timestamp).toLocaleString()} · {step.actorName}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside className="space-y-5 lg:col-span-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
            <h2 className="font-display mb-3 text-base font-bold text-[#0F1D3A]">Summary</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Status</span>
                <span className="font-bold uppercase text-[#1155EE]">{order.orderStatus.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Payment ({order.paymentMethod.toUpperCase()})</span>
                <span className="font-bold uppercase">{order.paymentStatus}</span>
              </div>
              {order.trackingNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Tracking</span>
                  <span className="font-mono-tabular font-semibold">{order.courierName} · {order.trackingNumber}</span>
                </div>
              )}
              <div className="border-t border-slate-100 pt-2 flex justify-between">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-mono-tabular">৳{order.subtotal.toLocaleString()}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount</span>
                  <span className="font-mono-tabular">-৳{order.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600">Shipping</span>
                <span className="font-mono-tabular">৳{order.shippingCharge.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-[#0F1D3A]">
                <span>Total</span>
                <span className="font-mono-tabular text-[#1155EE]">৳{order.total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-600">
            <h3 className="font-display mb-2 text-sm font-bold text-[#0F1D3A]">Shipping Snapshot</h3>
            <p className="font-semibold text-[#0F1D3A]">{order.shippingAddress.recipientName}</p>
            <p>{order.shippingAddress.phone}</p>
            <p className="mt-1">
              {order.shippingAddress.house}
              {order.shippingAddress.road ? `, ${order.shippingAddress.road}` : ''}, {order.shippingAddress.area},{' '}
              {order.shippingAddress.upazila}, {order.shippingAddress.district}, {order.shippingAddress.division}
            </p>
          </div>
        </aside>
      </div>

      <Modal open={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title="Cancel Order" size="sm">
        <form onSubmit={handleCancelOrder} className="space-y-4">
          <label className="block text-xs font-semibold text-slate-700">Cancellation Reason *</label>
          <textarea
            required
            minLength={3}
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Please share why you are cancelling..."
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCancelModalOpen(false)} className="rounded-lg border px-4 py-2 text-xs font-semibold">
              Keep Order
            </button>
            <button type="submit" className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white">
              Confirm Cancellation
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={returnModalOpen} onClose={() => setReturnModalOpen(false)} title="Request Return" size="sm">
        <form onSubmit={handleReturnSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Return Reason *</label>
            <input
              type="text"
              required
              minLength={3}
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="e.g. Damaged item / Wrong variant"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Additional Details</label>
            <textarea
              rows={3}
              value={returnDetails}
              onChange={(e) => setReturnDetails(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setReturnModalOpen(false)} className="rounded-lg border px-4 py-2 text-xs font-semibold">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-[#1155EE] px-4 py-2 text-xs font-semibold text-white">
              Submit Request
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function SavedAddressesPage() {
  useSeoMeta({ title: 'Saved Addresses | NOVARA COMMERCE', noIndex: true });
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);

  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedAddress | null>(null);

  const [label, setLabel] = useState('Home');
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [division, setDivision] = useState('Dhaka');
  const [district, setDistrict] = useState('Dhaka');
  const [upazila, setUpazila] = useState('Dhanmondi');
  const [area, setArea] = useState('Kalabagan');
  const [house, setHouse] = useState('');
  const [road, setRoad] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const loadAddresses = () => {
    if (!user) return;
    apiRequest<{ ok: true; addresses: SavedAddress[] }>('/api/account/addresses')
      .then((res) => setAddresses(res.addresses))
      .catch(() => undefined);
  };

  useEffect(() => {
    loadAddresses();
  }, [user]);

  if (!user) return <AccountAuthGate title="Saved Addresses" />;

  const openCreateModal = () => {
    setEditingId(null);
    setLabel('Home');
    setRecipientName(user.name);
    setPhone(user.phone || '');
    setDivision('Dhaka');
    setDistrict('Dhaka');
    setUpazila('Dhanmondi');
    setArea('Kalabagan');
    setHouse('');
    setRoad('');
    setIsDefault(addresses.length === 0);
    setModalOpen(true);
  };

  const openEditModal = (addr: SavedAddress) => {
    setEditingId(addr.id);
    setLabel(addr.label);
    setRecipientName(addr.recipientName);
    setPhone(addr.phone);
    setDivision(addr.division);
    setDistrict(addr.district);
    setUpazila(addr.upazila);
    setArea(addr.area);
    setHouse(addr.house);
    setRoad(addr.road || '');
    setIsDefault(addr.isDefault);
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload = { label, recipientName, phone, division, district, upazila, area, house, road, isDefault };
      if (editingId) {
        await apiRequest(`/api/account/addresses/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await apiRequest('/api/account/addresses', { method: 'POST', body: JSON.stringify(payload) });
      }
      setModalOpen(false);
      loadAddresses();
      dispatch(showToast({ variant: 'success', message: 'Address saved.' }));
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Unable to save address' }));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/api/account/addresses/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      loadAddresses();
      dispatch(showToast({ variant: 'info', message: 'Address deleted.' }));
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Delete failed' }));
    }
  };

  return (
    <div className="mx-auto max-w-[1140px] px-4 py-8">
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        <Link to="/account" className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-200">Profile</Link>
        <Link to="/account/orders" className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-200">My Orders</Link>
        <Link to="/account/addresses" className="rounded-lg bg-[#1155EE] px-4 py-2 text-xs font-semibold text-white">Saved Addresses</Link>
        <Link to="/wishlist" className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-200">Wishlist</Link>
      </div>

      <div className="mb-5 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-[#0F1D3A]">Saved Bangladesh Addresses</h1>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#1155EE] px-4 py-2 text-xs font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> Add Address
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {addresses.map((addr) => (
          <div key={addr.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#1155EE]" />
                <span className="text-sm font-bold text-[#0F1D3A]">{addr.label}</span>
                {addr.isDefault && <span className="text-xs font-semibold text-emerald-700">· Default</span>}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button type="button" onClick={() => openEditModal(addr)} className="font-semibold text-[#1155EE] hover:underline">
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(addr)}
                  aria-label={`Delete ${addr.label}`}
                  className="text-rose-600 hover:text-rose-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="mt-2 text-sm font-semibold text-[#0F1D3A]">{addr.recipientName}</p>
            <p className="text-xs text-slate-600">{addr.phone}</p>
            <p className="mt-1 text-xs text-slate-500">
              {addr.house}{addr.road ? `, ${addr.road}` : ''}, {addr.area}, {addr.upazila}, {addr.district}, {addr.division}
            </p>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Address' : 'Add New Address'} size="md">
        <form onSubmit={handleSave} className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <input type="text" required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (Home / Office)" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <input type="text" required value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Recipient Name" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (+880...)" className="rounded-xl border border-slate-300 px-3 py-2 text-sm sm:col-span-2" />
          <select
            value={division}
            onChange={(e) => {
              const d = e.target.value;
              setDivision(d);
              const firstDist = getDistrictsForDivision(d)[0]?.name || '';
              setDistrict(firstDist);
              const firstUpa = getUpazilasForDistrict(d, firstDist)[0]?.name || '';
              setUpazila(firstUpa);
              setArea(getAreasForUpazila(d, firstDist, firstUpa)[0]?.name || '');
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {getDivisionNames().map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={district}
            onChange={(e) => {
              const dist = e.target.value;
              setDistrict(dist);
              const firstUpa = getUpazilasForDistrict(division, dist)[0]?.name || '';
              setUpazila(firstUpa);
              setArea(getAreasForUpazila(division, dist, firstUpa)[0]?.name || '');
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {getDistrictsForDivision(division).map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
          </select>
          <select
            value={upazila}
            onChange={(e) => {
              const upa = e.target.value;
              setUpazila(upa);
              setArea(getAreasForUpazila(division, district, upa)[0]?.name || '');
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {getUpazilasForDistrict(division, district).map((u) => <option key={u.name} value={u.name}>{u.name}</option>)}
          </select>
          <select value={area} onChange={(e) => setArea(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
            {getAreasForUpazila(division, district, upazila).map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
          </select>
          <input type="text" required value={house} onChange={(e) => setHouse(e.target.value)} placeholder="House / Flat *" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <input type="text" value={road} onChange={(e) => setRoad(e.target.value)} placeholder="Road / Street" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-xs sm:col-span-2">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Set as default shipping address
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border px-4 py-2 text-xs font-semibold">Cancel</button>
            <button type="submit" className="rounded-lg bg-[#1155EE] px-5 py-2 text-xs font-semibold text-white">Save Address</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Address"
        message={`Remove saved address "${deleteTarget?.label}"?`}
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}

export function WishlistPage() {
  useSeoMeta({ title: 'My Wishlist | NOVARA COMMERCE', noIndex: true });
  const { user } = useAppSelector((s) => s.auth);
  const [products, setProducts] = useState<ProductItem[]>([]);

  useEffect(() => {
    if (!user) return;
    apiRequest<{ ok: true; products: ProductItem[] }>('/api/account/wishlist')
      .then((res) => setProducts(res.products))
      .catch(() => undefined);
  }, [user]);

  if (!user) return <AccountAuthGate title="My Wishlist" />;

  return (
    <div className="mx-auto max-w-[1140px] px-4 py-8">
      <h1 className="font-display mb-5 text-2xl font-bold text-[#0F1D3A]">Saved Wishlist</h1>
      {products.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <Heart className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Your wishlist is currently empty.</p>
          <Link to="/shop" className="mt-4 inline-block rounded-full bg-[#1155EE] px-6 py-2 text-xs font-semibold text-white">
            Explore Catalog
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
