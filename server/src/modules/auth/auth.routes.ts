import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireDatabase } from '../../database/connection';
import { authenticateRequired } from '../../middleware/auth.middleware';
import {
  adminLoginController,
  changePasswordController,
  facebookOAuthCallbackController,
  facebookOAuthRedirectController,
  forgotPasswordController,
  getAuthProviders,
  googleOAuthCallbackController,
  googleOAuthRedirectController,
  loginController,
  logoutController,
  meController,
  registerController,
  resetPasswordController,
  updateProfileController,
} from './auth.controller';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, code: 'RATE_LIMITED', error: 'Too many authentication attempts. Please try again shortly.' },
});

router.get('/providers', getAuthProviders);
router.post('/register', authLimiter, requireDatabase, registerController);
router.post('/login', authLimiter, requireDatabase, loginController);
router.post('/admin/login', authLimiter, requireDatabase, adminLoginController);
router.post('/logout', logoutController);
router.get('/me', requireDatabase, authenticateRequired, meController);
router.patch('/profile', requireDatabase, authenticateRequired, updateProfileController);
router.post('/change-password', requireDatabase, authenticateRequired, changePasswordController);
router.post('/forgot-password', authLimiter, requireDatabase, forgotPasswordController);
router.post('/reset-password', authLimiter, requireDatabase, resetPasswordController);
router.get('/oauth/google', googleOAuthRedirectController);
router.get('/oauth/google/callback', requireDatabase, googleOAuthCallbackController);
router.get('/oauth/facebook', facebookOAuthRedirectController);
router.get('/oauth/facebook/callback', requireDatabase, facebookOAuthCallbackController);

export default router;
