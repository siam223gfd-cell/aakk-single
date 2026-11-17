import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Tag, Trash2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { applyCouponAsync, updateCartQtyAsync } from '../features/cart/cartSlice';
import { openAuthModal } from '../features/auth/authSlice';
import { showToast } from '../features/notifications/toastSlice';
import { ResilientImage } from '../components/ui/ResilientImage';
import { formatStoreCurrency } from '../lib/dateTime';
import { useSeoMeta } from '../lib/useSeoMeta';

export function CartPage() {
  useSeoMeta({ title: 'Shopping Cart | NOVARA COMMERCE', noIndex: true });

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items, subtotal, discount, couponCode, appliedRuleName } = useAppSelector((s) => s.cart);
  const { user } = useAppSelector((s) => s.auth);
  const { settings } = useAppSelector((s) => s.storefront);
  const currencyCfg = settings?.currencySettings;
  const freeShippingThreshold = settings?.shippingSettings?.freeShippingThreshold ?? 999;

  const [couponInput, setCouponInput] = useState(couponCode || '');

  const handleQty = async (productId: string, variantId: string | null | undefined, qty: number) => {
    const res = await dispatch(
      updateCartQtyAsync({ productId, variantId, quantity: qty, isAuthenticated: Boolean(user) }),
    );
    if (updateCartQtyAsync.rejected.match(res)) {
      dispatch(showToast({ variant: 'error', message: String(res.payload || 'Unable to update cart') }));
    }
  };

  const handleApplyCoupon = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      dispatch(
        openAuthModal({
          tab: 'login',
          returnUrl: '/cart',
          notice: 'Sign in to validate and apply promotional coupons.',
        }),
      );
      return;
    }
    const res = await dispatch(applyCouponAsync(couponInput.trim()));
    if (applyCouponAsync.fulfilled.match(res)) {
      dispatch(
        showToast({
          variant: 'success',
          message: res.payload.couponCode ? `Coupon ${res.payload.couponCode} applied!` : 'Coupon removed.',
        }),
      );
    } else {
      dispatch(showToast({ variant: 'error', message: String(res.payload || 'Invalid coupon') }));
    }
  };

  const handleCheckout = () => {
    if (!user) {
      dispatch(
        openAuthModal({
          tab: 'login',
          returnUrl: '/checkout',
          notice: 'Please sign in or register an account before placing an order.',
        }),
      );
      return;
    }
    navigate('/checkout');
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <ShoppingBag className="mx-auto h-14 w-14 text-slate-300" />
        <h1 className="font-display mt-4 text-2xl font-bold text-[#0F1D3A]">Your Cart is Empty</h1>
        <p className="mt-2 text-sm text-slate-500">Add products from our store to review quantities, coupons, and delivery charges.</p>
        <Link to="/shop" className="mt-6 inline-block rounded-full bg-[#1155EE] px-7 py-2.5 text-sm font-semibold text-white">
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1380px] px-4 py-8">
      <h1 className="font-display mb-6 text-2xl font-bold text-[#0F1D3A]">Shopping Cart ({items.length} items)</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-8">
          {items.map((item) => (
            <div
              key={`${item.productId}-${item.variantId || 'default'}`}
              className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"
            >
              <Link
                to={`/product/${item.slug}`}
                className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-[#F8FAFC] p-2"
              >
                <ResilientImage src={item.imageUrl} alt={item.name} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link to={`/product/${item.slug}`} className="font-display text-base font-bold text-[#0F1D3A] hover:text-[#1155EE]">
                  {item.name}
                </Link>
                <p className="mt-0.5 font-mono-tabular text-xs text-slate-500">
                  SKU: {item.sku} {item.variantTitle ? `· ${item.variantTitle}` : ''}
                </p>
                <p className="mt-1 font-mono-tabular text-sm font-bold text-[#1155EE]">
                  ৳{item.unitPrice.toLocaleString()} each
                </p>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <div className="flex items-center rounded-xl border border-slate-300">
                  <button
                    type="button"
                    onClick={() => handleQty(item.productId, item.variantId, item.quantity - 1)}
                    aria-label={`Decrease ${item.name} quantity`}
                    className="p-2 hover:bg-slate-50"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="font-mono-tabular w-9 text-center text-sm font-bold">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => handleQty(item.productId, item.variantId, item.quantity + 1)}
                    aria-label={`Increase ${item.name} quantity`}
                    className="p-2 hover:bg-slate-50"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <p className="font-mono-tabular w-24 text-right text-base font-bold text-[#0F1D3A]">
                  ৳{(item.unitPrice * item.quantity).toLocaleString()}
                </p>
                <button
                  type="button"
                  onClick={() => handleQty(item.productId, item.variantId, 0)}
                  aria-label={`Remove ${item.name}`}
                  className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-4 lg:self-start">
          <h2 className="font-display text-lg font-bold text-[#0F1D3A]">Order Summary</h2>

          <form onSubmit={handleApplyCoupon} className="mt-4 flex gap-2">
            <div className="relative flex-1">
              <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="Coupon code (e.g. NOVARA10)"
                className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-xs uppercase focus:border-[#1155EE] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl border border-[#1155EE] px-4 py-2 text-xs font-semibold text-[#1155EE] hover:bg-[#E9F0FD]"
            >
              Apply
            </button>
          </form>

          <div className="mt-5 space-y-2.5 border-t border-slate-200 pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-mono-tabular font-semibold">{formatStoreCurrency(subtotal, currencyCfg)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>{couponCode ? `Discount (${couponCode})` : appliedRuleName ? `Promo (${appliedRuleName})` : 'Discount'}</span>
                <span className="font-mono-tabular font-semibold">-{formatStoreCurrency(discount, currencyCfg)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-slate-500">
              <span>Shipping</span>
              <span>
                {freeShippingThreshold > 0 && subtotal >= freeShippingThreshold
                  ? 'Free Standard Shipping eligible'
                  : 'Calculated at checkout'}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold text-[#0F1D3A]">
              <span>Estimated Total</span>
              <span className="font-mono-tabular text-[#1155EE]">
                {formatStoreCurrency(Math.max(0, subtotal - discount), currencyCfg)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCheckout}
            className="mt-5 w-full rounded-xl bg-[#1155EE] py-3 text-sm font-semibold text-white hover:bg-[#0B44CC]"
          >
            {user ? 'Proceed to Checkout' : 'Sign In to Checkout'}
          </button>
        </aside>
      </div>
    </div>
  );
}
