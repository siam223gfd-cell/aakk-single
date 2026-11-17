import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CartLine } from '../../types/commerce';
import { apiRequest } from '../../services/api';
import { mergeCartLines } from '../../lib/pricingEngine';

const GUEST_CART_KEY = 'novara_guest_cart_v1';

function loadGuestCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveGuestCart(items: CartLine[]) {
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota issues
  }
}

function clearGuestCartStorage() {
  try {
    localStorage.removeItem(GUEST_CART_KEY);
  } catch {
    // Ignore
  }
}

export interface CartState {
  items: CartLine[];
  couponCode: string | null;
  appliedRuleName: string | null;
  subtotal: number;
  discount: number;
  loading: boolean;
  drawerOpen: boolean;
  error: string | null;
}

function recomputeGuestTotals(items: CartLine[]) {
  return items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
}

const initialItems = loadGuestCart();

const initialState: CartState = {
  items: initialItems,
  couponCode: null,
  appliedRuleName: null,
  subtotal: recomputeGuestTotals(initialItems),
  discount: 0,
  loading: false,
  drawerOpen: false,
  error: null,
};

interface ServerCartResponse {
  ok: true;
  cart: {
    items: CartLine[];
    couponCode: string | null;
    appliedRuleName?: string | null;
    subtotal: number;
    discount: number;
  };
}

export const fetchServerCart = createAsyncThunk('cart/fetchServer', async () => {
  const res = await apiRequest<ServerCartResponse>('/api/account/cart');
  return res.cart;
});

export const mergeGuestCartOnLogin = createAsyncThunk('cart/mergeGuest', async () => {
  const guestItems = loadGuestCart();
  if (guestItems.length === 0) {
    const res = await apiRequest<ServerCartResponse>('/api/account/cart');
    return res.cart;
  }
  const res = await apiRequest<ServerCartResponse>('/api/account/cart/merge', {
    method: 'POST',
    body: JSON.stringify({
      items: guestItems.map((i) => ({
        productId: i.productId,
        variantId: i.variantId || null,
        quantity: i.quantity,
      })),
    }),
  });
  clearGuestCartStorage();
  return res.cart;
});

export const addToCartAsync = createAsyncThunk(
  'cart/addItem',
  async (
    payload: { item: CartLine; isAuthenticated: boolean },
    { rejectWithValue },
  ) => {
    if (!payload.isAuthenticated) {
      return { mode: 'guest' as const, item: payload.item };
    }
    try {
      const res = await apiRequest<ServerCartResponse>('/api/account/cart/items', {
        method: 'POST',
        body: JSON.stringify({
          productId: payload.item.productId,
          variantId: payload.item.variantId || null,
          quantity: payload.item.quantity,
        }),
      });
      return { mode: 'server' as const, cart: res.cart };
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Unable to add item to cart');
    }
  },
);

export const updateCartQtyAsync = createAsyncThunk(
  'cart/updateQty',
  async (
    payload: { productId: string; variantId?: string | null; quantity: number; isAuthenticated: boolean },
    { rejectWithValue },
  ) => {
    if (!payload.isAuthenticated) {
      return {
        mode: 'guest' as const,
        productId: payload.productId,
        variantId: payload.variantId || null,
        quantity: payload.quantity,
      };
    }
    try {
      const res = await apiRequest<ServerCartResponse>('/api/account/cart/items', {
        method: 'PATCH',
        body: JSON.stringify({
          productId: payload.productId,
          variantId: payload.variantId || null,
          quantity: payload.quantity,
        }),
      });
      return { mode: 'server' as const, cart: res.cart };
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to update cart quantity');
    }
  },
);

export const applyCouponAsync = createAsyncThunk(
  'cart/applyCoupon',
  async (code: string, { rejectWithValue }) => {
    try {
      const res = await apiRequest<ServerCartResponse>('/api/account/cart/coupon', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      return res.cart;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Invalid or ineligible coupon');
    }
  },
);

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    openCartDrawer(state) {
      state.drawerOpen = true;
    },
    closeCartDrawer(state) {
      state.drawerOpen = false;
    },
    clearCartAfterOrder(state) {
      state.items = [];
      state.couponCode = null;
      state.appliedRuleName = null;
      state.subtotal = 0;
      state.discount = 0;
      state.error = null;
      clearGuestCartStorage();
    },
    resetToGuestCart(state) {
      const items = loadGuestCart();
      state.items = items;
      state.couponCode = null;
      state.appliedRuleName = null;
      state.subtotal = recomputeGuestTotals(items);
      state.discount = 0;
    },
    setCartError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchServerCart.fulfilled, (state, action) => {
        if (action.payload) {
          state.items = action.payload.items ?? [];
          state.couponCode = action.payload.couponCode ?? null;
          state.appliedRuleName = action.payload.appliedRuleName ?? null;
          state.subtotal = action.payload.subtotal ?? 0;
          state.discount = action.payload.discount ?? 0;
        }
        state.loading = false;
      })
      .addCase(mergeGuestCartOnLogin.fulfilled, (state, action) => {
        if (action.payload) {
          state.items = action.payload.items ?? [];
          state.couponCode = action.payload.couponCode ?? null;
          state.appliedRuleName = action.payload.appliedRuleName ?? null;
          state.subtotal = action.payload.subtotal ?? 0;
          state.discount = action.payload.discount ?? 0;
        }
        state.loading = false;
      })
      .addCase(addToCartAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addToCartAsync.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.mode === 'server') {
          if (action.payload.cart) {
            state.items = action.payload.cart.items ?? [];
            state.couponCode = action.payload.cart.couponCode ?? null;
            state.appliedRuleName = action.payload.cart.appliedRuleName ?? null;
            state.subtotal = action.payload.cart.subtotal ?? 0;
            state.discount = action.payload.cart.discount ?? 0;
          }
        } else {
          const incoming = action.payload.item;
          const merged = mergeCartLines(
            state.items.map((x) => ({ ...x, maxStock: x.availableStock })),
            [{ ...incoming, maxStock: incoming.availableStock }],
          );
          state.items = merged;
          state.subtotal = recomputeGuestTotals(merged);
          saveGuestCart(merged);
        }
      })
      .addCase(addToCartAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = String(action.payload || 'Unable to add item');
      })
      .addCase(updateCartQtyAsync.fulfilled, (state, action) => {
        if (action.payload.mode === 'server') {
          if (action.payload.cart) {
            state.items = action.payload.cart.items ?? [];
            state.couponCode = action.payload.cart.couponCode ?? null;
            state.appliedRuleName = action.payload.cart.appliedRuleName ?? null;
            state.subtotal = action.payload.cart.subtotal ?? 0;
            state.discount = action.payload.cart.discount ?? 0;
          }
        } else {
          const { productId, variantId, quantity } = action.payload;
          const vKey = variantId || null;
          if (quantity <= 0) {
            state.items = state.items.filter(
              (i) => !(i.productId === productId && (i.variantId || null) === vKey),
            );
          } else {
            state.items = state.items.map((i) =>
              i.productId === productId && (i.variantId || null) === vKey
                ? { ...i, quantity: Math.min(quantity, Math.max(1, i.availableStock)) }
                : i,
            );
          }
          state.subtotal = recomputeGuestTotals(state.items);
          saveGuestCart(state.items);
        }
      })
      .addCase(applyCouponAsync.fulfilled, (state, action) => {
        if (action.payload) {
          state.items = action.payload.items ?? [];
          state.couponCode = action.payload.couponCode ?? null;
          state.appliedRuleName = action.payload.appliedRuleName ?? null;
          state.subtotal = action.payload.subtotal ?? 0;
          state.discount = action.payload.discount ?? 0;
        }
        state.error = null;
      })
      .addCase(applyCouponAsync.rejected, (state, action) => {
        state.error = String(action.payload || 'Coupon error');
      });
  },
});

export const {
  openCartDrawer,
  closeCartDrawer,
  clearCartAfterOrder,
  resetToGuestCart,
  setCartError,
} = cartSlice.actions;

// Cart badge MUST reflect unique cart lines, not total item quantity
export const selectCartLineCount = (state: { cart: CartState }) => state.cart.items.length;

export default cartSlice.reducer;
