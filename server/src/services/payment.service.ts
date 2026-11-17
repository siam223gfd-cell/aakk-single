import { env, integrations } from '../config/env';
import { AppError } from '../middleware/error.middleware';

export interface InitiateGatewayParams {
  orderNumber: string;
  transactionId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: {
    house: string;
    area: string;
    upazila: string;
    district: string;
    division: string;
    postalCode?: string;
  };
}

export async function initiateSslCommerzPayment(params: InitiateGatewayParams): Promise<{
  gatewayUrl: string;
  sessionKey?: string;
}> {
  if (!integrations.paymentGateway) {
    throw new AppError(
      503,
      'PAYMENT_GATEWAY_UNCONFIGURED',
      'Online payment gateway (SSLCommerz) credentials are not configured. Set PAYMENT_STORE_ID and PAYMENT_STORE_PASSWORD or choose Cash on Delivery.',
    );
  }

  const baseEndpoint = env.PAYMENT_SANDBOX
    ? 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php'
    : 'https://securepay.sslcommerz.com/gwprocess/v4/api.php';

  const body = new URLSearchParams({
    store_id: env.PAYMENT_STORE_ID,
    store_passwd: env.PAYMENT_STORE_PASSWORD,
    total_amount: String(params.amount),
    currency: 'BDT',
    tran_id: params.transactionId,
    success_url: `${env.APP_URL}/api/payments/callback/success`,
    fail_url: `${env.APP_URL}/api/payments/callback/fail`,
    cancel_url: `${env.APP_URL}/api/payments/callback/cancel`,
    ipn_url: `${env.APP_URL}/api/payments/ipn`,
    shipping_method: 'Courier',
    product_name: `NOVARA Order ${params.orderNumber}`,
    product_category: 'Retail',
    product_profile: 'general',
    cus_name: params.customerName,
    cus_email: params.customerEmail,
    cus_add1: `${params.shippingAddress.house}, ${params.shippingAddress.area}`,
    cus_city: params.shippingAddress.district,
    cus_state: params.shippingAddress.division,
    cus_postcode: params.shippingAddress.postalCode || '1000',
    cus_country: 'Bangladesh',
    cus_phone: params.customerPhone,
    ship_name: params.customerName,
    ship_add1: `${params.shippingAddress.house}, ${params.shippingAddress.area}`,
    ship_city: params.shippingAddress.district,
    ship_state: params.shippingAddress.division,
    ship_postcode: params.shippingAddress.postalCode || '1000',
    ship_country: 'Bangladesh',
  });

  const resp = await fetch(baseEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = (await resp.json()) as {
    status?: string;
    GatewayPageURL?: string;
    sessionkey?: string;
    failedreason?: string;
  };

  if (!resp.ok || data.status !== 'SUCCESS' || !data.GatewayPageURL) {
    throw new AppError(502, 'PAYMENT_INITIATION_FAILED', data.failedreason || 'Failed to initiate payment session with gateway.');
  }

  return {
    gatewayUrl: data.GatewayPageURL,
    sessionKey: data.sessionkey,
  };
}

export async function validateSslCommerzTransaction(valId: string): Promise<{
  verified: boolean;
  status?: string;
  amount?: number;
  tranId?: string;
  bankTranId?: string;
  raw?: Record<string, unknown>;
}> {
  if (!integrations.paymentGateway) {
    return { verified: false };
  }

  const validatorEndpoint = env.PAYMENT_SANDBOX
    ? 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php'
    : 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php';

  const url = `${validatorEndpoint}?val_id=${encodeURIComponent(valId)}&store_id=${encodeURIComponent(
    env.PAYMENT_STORE_ID,
  )}&store_passwd=${encodeURIComponent(env.PAYMENT_STORE_PASSWORD)}&format=json`;

  const resp = await fetch(url);
  if (!resp.ok) {
    return { verified: false };
  }

  const data = (await resp.json()) as Record<string, unknown>;
  const status = String(data.status || '');
  const verified = status === 'VALID' || status === 'VALIDATED';

  return {
    verified,
    status,
    amount: Number(data.amount || 0),
    tranId: String(data.tran_id || ''),
    bankTranId: String(data.bank_tran_id || ''),
    raw: data,
  };
}
