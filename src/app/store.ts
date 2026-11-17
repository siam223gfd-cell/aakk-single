import { configureStore } from '@reduxjs/toolkit';
import cartReducer from '../features/cart/cartSlice';
import authReducer from '../features/auth/authSlice';
import toastReducer from '../features/notifications/toastSlice';
import storefrontReducer from '../features/storefront/storefrontSlice';

export const store = configureStore({
  reducer: {
    cart: cartReducer,
    auth: authReducer,
    toast: toastReducer,
    storefront: storefrontReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
