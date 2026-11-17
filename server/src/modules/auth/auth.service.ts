import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { UserModel } from '../users/user.model';
import { AppError } from '../../middleware/error.middleware';
import { recordAuditLog, signAuthToken } from '../../middleware/auth.middleware';
import { env, integrations } from '../../config/env';
import { sendTransactionalEmail } from '../../services/email.service';
import { isStaffRole } from '../../../../src/lib/rbac';

export function serializeUser(user: {
  _id: unknown;
  name: string;
  email: string;
  phone?: string;
  role: string;
  customPermissions?: string[];
  isVerified: boolean;
  notificationPrefs?: { orderUpdates: boolean; promotions: boolean; backInStock: boolean };
}) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: user.role,
    customPermissions: user.customPermissions || [],
    isVerified: user.isVerified,
    notificationPrefs: user.notificationPrefs || {
      orderUpdates: true,
      promotions: false,
      backInStock: true,
    },
  };
}

export async function registerCustomerAccount(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
}) {
  const existing = await UserModel.findOne({ email: input.email });
  if (existing) {
    throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const rawVerifyToken = crypto.randomBytes(24).toString('hex');
  const verificationTokenHash = crypto.createHash('sha256').update(rawVerifyToken).digest('hex');

  const user = await UserModel.create({
    name: input.name,
    email: input.email,
    phone: input.phone,
    passwordHash,
    role: 'customer',
    isVerified: !integrations.resend,
    verificationTokenHash,
    notificationPrefs: { orderUpdates: true, promotions: false, backInStock: true },
  });

  if (integrations.resend) {
    const verifyUrl = `${env.CLIENT_URL}/verify-email?token=${rawVerifyToken}&email=${encodeURIComponent(user.email)}`;
    await sendTransactionalEmail({
      to: user.email,
      template: 'account_verification',
      subject: 'Verify your NOVARA COMMERCE account',
      html: `<p>Welcome to NOVARA COMMERCE, ${user.name}.</p><p>Please verify your email address: <a href="${verifyUrl}">Verify Account</a></p>`,
    });
  }

  const token = signAuthToken(user);
  return { user: serializeUser(user), token };
}

export async function loginWithEmailPassword(input: {
  email: string;
  password: string;
  requireAdminStaff?: boolean;
}) {
  const user = await UserModel.findOne({ email: input.email }).select('+passwordHash');
  if (!user || !user.passwordHash) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }
  if (user.status !== 'active') {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended. Please contact an administrator.');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  if (input.requireAdminStaff && !isStaffRole(user.role)) {
    throw new AppError(403, 'ADMIN_ACCESS_REQUIRED', 'This account does not have administrator permissions.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  if (isStaffRole(user.role)) {
    await recordAuditLog({
      actor: user,
      action: input.requireAdminStaff ? 'auth.admin_login' : 'auth.login',
      resourceType: 'User',
      resourceId: String(user._id),
      summary: `Staff sign-in (${user.email}) [${user.role}]`,
    });
  }

  const token = signAuthToken(user);
  return { user: serializeUser(user), token };
}
