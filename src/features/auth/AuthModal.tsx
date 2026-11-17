import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Phone, User } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { closeAuthModal, loginUser, registerUser, setAuthModalTab } from './authSlice';
import { showToast } from '../notifications/toastSlice';
import { apiRequest } from '../../services/api';

export function AuthModal() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { modalOpen, modalTab, returnUrl, authNotice, loading } = useAppSelector((s) => s.auth);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [providers, setProviders] = useState({ google: false, facebook: false });
  const [forgotBusy, setForgotBusy] = useState(false);

  useEffect(() => {
    if (!modalOpen) return;
    setErrorMsg(null);
    apiRequest<{ ok: true; providers: { google: boolean; facebook: boolean } }>('/api/auth/providers')
      .then((res) => setProviders(res.providers))
      .catch(() => undefined);
  }, [modalOpen]);

  const handleSuccessRedirect = () => {
    if (returnUrl) {
      navigate(returnUrl);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = await dispatch(loginUser({ email, password }));
    if (loginUser.fulfilled.match(res)) {
      dispatch(showToast({ variant: 'success', message: `Welcome back, ${res.payload.name}!` }));
      handleSuccessRedirect();
    } else {
      setErrorMsg(String(res.payload || 'Invalid email or password.'));
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = await dispatch(registerUser({ name, email, phone: phone || undefined, password }));
    if (registerUser.fulfilled.match(res)) {
      dispatch(showToast({ variant: 'success', message: 'Account created and signed in.' }));
      handleSuccessRedirect();
    } else {
      setErrorMsg(String(res.payload || 'Could not create account.'));
    }
  };

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setForgotBusy(true);
    try {
      const res = await apiRequest<{ ok: true; message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      dispatch(showToast({ variant: 'info', message: res.message }));
      dispatch(setAuthModalTab('login'));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to process password reset.');
    } finally {
      setForgotBusy(false);
    }
  };

  const title =
    modalTab === 'login'
      ? 'Sign in to NOVARA'
      : modalTab === 'register'
      ? 'Create Your NOVARA Account'
      : 'Reset Your Password';

  return (
    <Modal
      open={modalOpen}
      onClose={() => dispatch(closeAuthModal())}
      title={title}
      description={authNotice || 'Access your orders, saved Bangladesh addresses, and fast checkout.'}
      size="sm"
    >
      <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => {
            setErrorMsg(null);
            dispatch(setAuthModalTab('login'));
          }}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
            modalTab === 'login' ? 'bg-white text-[#0F1D3A] shadow-sm' : 'text-slate-600 hover:text-[#0F1D3A]'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setErrorMsg(null);
            dispatch(setAuthModalTab('register'));
          }}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
            modalTab === 'register' ? 'bg-white text-[#0F1D3A] shadow-sm' : 'text-slate-600 hover:text-[#0F1D3A]'
          }`}
        >
          Register
        </button>
      </div>

      {errorMsg && (
        <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          {errorMsg}
        </div>
      )}

      {modalTab === 'login' && (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="auth-login-email" className="mb-1.5 block text-xs font-semibold text-slate-700">
              Email Address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="auth-login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-[#1155EE] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="auth-login-password" className="block text-xs font-semibold text-slate-700">
                Password
              </label>
              <button
                type="button"
                onClick={() => dispatch(setAuthModalTab('forgot'))}
                className="text-xs font-medium text-[#1155EE] hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="auth-login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-[#1155EE] focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#1155EE] py-2.5 text-sm font-semibold text-white hover:bg-[#0B44CC] disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      )}

      {modalTab === 'register' && (
        <form onSubmit={handleRegister} className="space-y-3.5">
          <div>
            <label htmlFor="auth-reg-name" className="mb-1 block text-xs font-semibold text-slate-700">
              Full Name
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="auth-reg-name"
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ayesha Akter"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-[#1155EE] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="auth-reg-email" className="mb-1 block text-xs font-semibold text-slate-700">
              Email Address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="auth-reg-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-[#1155EE] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="auth-reg-phone" className="mb-1 block text-xs font-semibold text-slate-700">
              Bangladesh Phone Number
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="auth-reg-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+880 17XX-XXXXXX"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-[#1155EE] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="auth-reg-password" className="mb-1 block text-xs font-semibold text-slate-700">
              Password (min 8 characters)
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="auth-reg-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-[#1155EE] focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#1155EE] py-2.5 text-sm font-semibold text-white hover:bg-[#0B44CC] disabled:opacity-60"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
      )}

      {modalTab === 'forgot' && (
        <form onSubmit={handleForgot} className="space-y-4">
          <div>
            <label htmlFor="auth-forgot-email" className="mb-1.5 block text-xs font-semibold text-slate-700">
              Account Email Address
            </label>
            <input
              id="auth-forgot-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#1155EE] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={forgotBusy}
            className="w-full rounded-xl bg-[#1155EE] py-2.5 text-sm font-semibold text-white hover:bg-[#0B44CC]"
          >
            {forgotBusy ? 'Sending link...' : 'Send Reset Link'}
          </button>
        </form>
      )}

      {modalTab !== 'forgot' && (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="mb-3 text-center text-xs text-slate-500">Or continue with</p>
          <div className="grid grid-cols-2 gap-2.5">
            {providers.google ? (
              <a
                href="/api/auth/oauth/google"
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Google
              </a>
            ) : (
              <button
                type="button"
                onClick={() =>
                  dispatch(
                    showToast({
                      variant: 'warning',
                      message: 'Google OAuth is unavailable until GOOGLE_CLIENT_ID is configured.',
                    }),
                  )
                }
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-400"
              >
                Google (Unconfigured)
              </button>
            )}

            {providers.facebook ? (
              <a
                href="/api/auth/oauth/facebook"
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Facebook
              </a>
            ) : (
              <button
                type="button"
                onClick={() =>
                  dispatch(
                    showToast({
                      variant: 'warning',
                      message: 'Facebook OAuth is unavailable until FACEBOOK_APP_ID is configured.',
                    }),
                  )
                }
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-400"
              >
                Facebook (Unconfigured)
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
