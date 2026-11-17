import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { UserModel } from '../users/user.model';
import { signAuthToken, type AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { env, integrations } from '../../config/env';
import { sendTransactionalEmail } from '../../services/email.service';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from './auth.validation';
import { loginWithEmailPassword, registerCustomerAccount, serializeUser } from './auth.service';

export function getAuthCookieOptions(req: Request) {
  const isHttps =
    env.COOKIE_SECURE ||
    req.secure ||
    req.get('x-forwarded-proto') === 'https';

  return {
    httpOnly: true,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    secure: isHttps,
    path: '/',
  };
}

export function setAuthCookie(req: Request, res: Response, token: string): void {
  res.cookie('novara_token', token, {
    ...getAuthCookieOptions(req),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function getAuthProviders(_req: Request, res: Response): void {
  res.json({
    ok: true,
    providers: {
      emailPassword: true,
      google: integrations.googleOAuth,
      facebook: integrations.facebookOAuth,
    },
  });
}

export async function registerController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = registerSchema.parse(req.body);
    const { user, token } = await registerCustomerAccount(parsed);
    setAuthCookie(req, res, token);
    res.status(201).json({ ok: true, user, token });
  } catch (err) {
    next(err);
  }
}

export async function loginController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = loginSchema.parse(req.body);
    const { user, token } = await loginWithEmailPassword(parsed);
    setAuthCookie(req, res, token);
    res.json({ ok: true, user, token });
  } catch (err) {
    next(err);
  }
}

export async function adminLoginController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = loginSchema.parse(req.body);
    const { user, token } = await loginWithEmailPassword({ ...parsed, requireAdminStaff: true });
    setAuthCookie(req, res, token);
    res.json({ ok: true, user, token });
  } catch (err) {
    next(err);
  }
}

export function logoutController(req: Request, res: Response): void {
  res.clearCookie('novara_token', getAuthCookieOptions(req));
  res.json({ ok: true });
}

export function meController(req: AuthenticatedRequest, res: Response): void {
  res.json({ ok: true, user: serializeUser(req.user!) });
}

export async function updateProfileController(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = updateProfileSchema.parse(req.body);
    const user = req.user!;
    user.name = parsed.name;
    if (parsed.phone !== undefined) user.phone = parsed.phone;
    if (parsed.notificationPrefs) user.notificationPrefs = parsed.notificationPrefs;
    await user.save();
    res.json({ ok: true, user: serializeUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function changePasswordController(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = changePasswordSchema.parse(req.body);
    const user = await UserModel.findById(req.user!._id).select('+passwordHash');
    if (!user || !user.passwordHash) {
      throw new AppError(400, 'NO_PASSWORD_SET', 'This account uses external OAuth login.');
    }
    const valid = await bcrypt.compare(parsed.currentPassword, user.passwordHash);
    if (!valid) {
      throw new AppError(401, 'INVALID_PASSWORD', 'Current password is incorrect.');
    }
    user.passwordHash = await bcrypt.hash(parsed.newPassword, 12);
    await user.save();
    res.json({ ok: true, message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
}

export async function forgotPasswordController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const user = await UserModel.findOne({ email });
    if (user) {
      const rawToken = crypto.randomBytes(24).toString('hex');
      user.resetTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      user.resetTokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await user.save();

      const resetUrl = `${env.CLIENT_URL}/?resetToken=${rawToken}&email=${encodeURIComponent(user.email)}`;
      await sendTransactionalEmail({
        to: user.email,
        template: 'password_reset',
        subject: 'Reset your NOVARA COMMERCE password',
        html: `<p>Click the link below to reset your password (valid for 30 minutes):</p><p><a href="${resetUrl}">Reset Password</a></p>`,
      });
    }
    res.json({
      ok: true,
      message: 'If an account matches that email, password reset instructions have been sent.',
    });
  } catch (err) {
    next(err);
  }
}

export async function resetPasswordController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = resetPasswordSchema.parse(req.body);
    const tokenHash = crypto.createHash('sha256').update(parsed.token).digest('hex');

    const user = await UserModel.findOne({
      email: parsed.email,
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: { $gt: new Date() },
    }).select('+resetTokenHash +resetTokenExpiresAt');

    if (!user) {
      throw new AppError(400, 'INVALID_RESET_TOKEN', 'Reset link is invalid or has expired.');
    }

    user.passwordHash = await bcrypt.hash(parsed.newPassword, 12);
    user.resetTokenHash = undefined;
    user.resetTokenExpiresAt = undefined;
    await user.save();

    res.json({ ok: true, message: 'Your password has been reset. You can now sign in.' });
  } catch (err) {
    next(err);
  }
}

export function googleOAuthRedirectController(_req: Request, res: Response): void {
  if (!integrations.googleOAuth) {
    res.status(503).json({
      ok: false,
      code: 'OAUTH_UNCONFIGURED',
      error: 'Google OAuth is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing).',
    });
    return;
  }
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${env.APP_URL}/api/auth/oauth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

export async function googleOAuthCallbackController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!integrations.googleOAuth) {
      throw new AppError(503, 'OAUTH_UNCONFIGURED', 'Google OAuth is not configured.');
    }
    const code = String(req.query.code || '');
    if (!code) {
      res.redirect(`${env.CLIENT_URL}/?authError=google_cancelled`);
      return;
    }

    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${env.APP_URL}/api/auth/oauth/google/callback`,
        grant_type: 'authorization_code',
      }).toString(),
    });
    const tokenData = (await tokenResp.json()) as { access_token?: string };
    if (!tokenResp.ok || !tokenData.access_token) {
      res.redirect(`${env.CLIENT_URL}/?authError=google_token_failed`);
      return;
    }

    const userInfoResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = (await userInfoResp.json()) as { sub?: string; email?: string; name?: string; email_verified?: boolean };
    if (!profile.email || !profile.sub) {
      res.redirect(`${env.CLIENT_URL}/?authError=google_profile_missing`);
      return;
    }

    let user = await UserModel.findOne({ email: profile.email.toLowerCase() });
    if (!user) {
      user = await UserModel.create({
        name: profile.name || profile.email.split('@')[0],
        email: profile.email.toLowerCase(),
        role: 'customer',
        isVerified: Boolean(profile.email_verified),
        oauthProviders: { googleId: profile.sub },
      });
    } else if (!user.oauthProviders?.googleId) {
      user.oauthProviders = { ...user.oauthProviders, googleId: profile.sub };
      await user.save();
    }

    const jwtToken = signAuthToken(user);
    setAuthCookie(req, res, jwtToken);
    res.redirect(`${env.CLIENT_URL}/?oauth=success`);
  } catch (err) {
    next(err);
  }
}

export function facebookOAuthRedirectController(_req: Request, res: Response): void {
  if (!integrations.facebookOAuth) {
    res.status(503).json({
      ok: false,
      code: 'OAUTH_UNCONFIGURED',
      error: 'Facebook OAuth is not configured (FACEBOOK_APP_ID / FACEBOOK_APP_SECRET missing).',
    });
    return;
  }
  const params = new URLSearchParams({
    client_id: env.FACEBOOK_APP_ID,
    redirect_uri: `${env.APP_URL}/api/auth/oauth/facebook/callback`,
    scope: 'email,public_profile',
    response_type: 'code',
  });
  res.redirect(`https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`);
}

export async function facebookOAuthCallbackController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!integrations.facebookOAuth) {
      throw new AppError(503, 'OAUTH_UNCONFIGURED', 'Facebook OAuth is not configured.');
    }
    const code = String(req.query.code || '');
    if (!code) {
      res.redirect(`${env.CLIENT_URL}/?authError=facebook_cancelled`);
      return;
    }

    const tokenUrl = new URL('https://graph.facebook.com/v20.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', env.FACEBOOK_APP_ID);
    tokenUrl.searchParams.set('client_secret', env.FACEBOOK_APP_SECRET);
    tokenUrl.searchParams.set('redirect_uri', `${env.APP_URL}/api/auth/oauth/facebook/callback`);
    tokenUrl.searchParams.set('code', code);

    const tokenResp = await fetch(tokenUrl.toString());
    const tokenData = (await tokenResp.json()) as { access_token?: string };
    if (!tokenResp.ok || !tokenData.access_token) {
      res.redirect(`${env.CLIENT_URL}/?authError=facebook_token_failed`);
      return;
    }

    const meResp = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(tokenData.access_token)}`,
    );
    const profile = (await meResp.json()) as { id?: string; name?: string; email?: string };
    if (!profile.email || !profile.id) {
      res.redirect(`${env.CLIENT_URL}/?authError=facebook_email_missing`);
      return;
    }

    let user = await UserModel.findOne({ email: profile.email.toLowerCase() });
    if (!user) {
      user = await UserModel.create({
        name: profile.name || 'Facebook Customer',
        email: profile.email.toLowerCase(),
        role: 'customer',
        isVerified: true,
        oauthProviders: { facebookId: profile.id },
      });
    } else if (!user.oauthProviders?.facebookId) {
      user.oauthProviders = { ...user.oauthProviders, facebookId: profile.id };
      await user.save();
    }

    const jwtToken = signAuthToken(user);
    setAuthCookie(req, res, jwtToken);
    res.redirect(`${env.CLIENT_URL}/?oauth=success`);
  } catch (err) {
    next(err);
  }
}
