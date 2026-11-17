import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBangladeshAddressHierarchy,
  calculateShippingCharge,
  getDistrictsForDivision,
  getUpazilasForDistrict,
} from './bdLocations';
import {
  resolveEffectiveUnitPrice,
  evaluateCouponDiscount,
  evaluateDiscountRules,
  mergeCartLines,
  calculateOrderTotals,
} from './pricingEngine';
import {
  canTransitionOrderStatus,
  canCustomerCancelOrder,
  canCustomerRequestReturn,
  computeAvailableStock,
  shouldRestoreStockOnCancel,
} from './orderStateMachine';
import { expandCrossLingualTerms, buildHighlightSegments } from './crossLingualSearch';
import { hasPermission } from './rbac';
import { ApiError, parseApiResponsePayload } from '../services/api';
import { formatStoreCurrency, isWithinScheduleWindow, toLocalDateTimeInputValue } from './dateTime';

test('Bangladesh address hierarchy validates Division -> District -> Upazila -> Area', () => {
  assert.equal(
    validateBangladeshAddressHierarchy({
      division: 'Dhaka',
      district: 'Dhaka',
      upazila: 'Dhanmondi',
      area: 'Kalabagan',
    }).valid,
    true,
  );
  assert.equal(
    validateBangladeshAddressHierarchy({
      division: 'Dhaka',
      district: 'Sylhet',
      upazila: 'Sylhet Sadar',
      area: 'Zindabazar',
    }).valid,
    false,
  );
  assert.ok(getDistrictsForDivision('Chattogram').length >= 2);
  assert.ok(getUpazilasForDistrict('Dhaka', 'Dhaka').length >= 5);
});

test('Shipping calculator applies Dhaka Metro, Suburb, Nationwide, Express and ৳999 Free Shipping rules', () => {
  const metroUnder = calculateShippingCharge({
    division: 'Dhaka',
    district: 'Dhaka',
    upazila: 'Gulshan',
    subtotal: 500,
  });
  assert.equal(metroUnder.zone, 'dhaka_metro');
  assert.equal(metroUnder.charge, 60);
  assert.equal(metroUnder.freeShippingApplied, false);

  const metroFree = calculateShippingCharge({
    division: 'Dhaka',
    district: 'Dhaka',
    upazila: 'Gulshan',
    subtotal: 999,
  });
  assert.equal(metroFree.charge, 0);
  assert.equal(metroFree.freeShippingApplied, true);

  const nationwideExpress = calculateShippingCharge({
    division: 'Sylhet',
    district: 'Sylhet',
    upazila: 'Sylhet Sadar',
    subtotal: 2000,
    deliveryMethod: 'express',
  });
  assert.equal(nationwideExpress.zone, 'nationwide');
  assert.equal(nationwideExpress.charge, 80);
});

test('Flash-sale expiration falls back to salePrice or basePrice', () => {
  const now = new Date('2026-11-16T12:00:00Z');
  const active = resolveEffectiveUnitPrice(
    {
      basePrice: 10000,
      salePrice: 8500,
      flashSalePrice: 7000,
      flashSaleStartsAt: '2026-11-16T00:00:00Z',
      flashSaleEndsAt: '2026-11-17T00:00:00Z',
    },
    now,
  );
  assert.equal(active.currentPrice, 7000);
  assert.equal(active.isFlashSaleActive, true);
  assert.equal(active.discountPercent, 30);

  const expired = resolveEffectiveUnitPrice(
    {
      basePrice: 10000,
      salePrice: 8500,
      flashSalePrice: 7000,
      flashSaleStartsAt: '2026-11-14T00:00:00Z',
      flashSaleEndsAt: '2026-11-15T23:59:59Z',
    },
    now,
  );
  assert.equal(expired.currentPrice, 8500);
  assert.equal(expired.isFlashSaleActive, false);
});

test('Coupon evaluation enforces minOrder, maxDiscountAmount, expiry, and category eligibility', () => {
  const now = new Date('2026-11-16T12:00:00Z');
  const items = [
    { productId: 'p1', categoryId: 'cat-elec', quantity: 2, unitPrice: 1500 },
    { productId: 'p2', categoryId: 'cat-books', quantity: 1, unitPrice: 500 },
  ];

  const validPct = evaluateCouponDiscount(
    {
      code: 'NOVARA10',
      discountType: 'percentage',
      discountValue: 10,
      maxDiscountAmount: 250,
      minOrderAmount: 1000,
      isActive: true,
      usedCount: 0,
      endsAt: '2026-12-31T00:00:00Z',
    },
    items,
    now,
  );
  assert.equal(validPct.valid, true);
  assert.equal(validPct.discountAmount, 250);

  const expired = evaluateCouponDiscount(
    {
      code: 'OLD',
      discountType: 'fixed',
      discountValue: 500,
      minOrderAmount: 0,
      isActive: true,
      usedCount: 0,
      endsAt: '2026-11-01T00:00:00Z',
    },
    items,
    now,
  );
  assert.equal(expired.valid, false);
});

test('Cart merge deduplicates matching product/variant lines and clamps to stock', () => {
  const merged = mergeCartLines(
    [
      { productId: 'p1', variantId: 'v1', quantity: 2, maxStock: 5 },
      { productId: 'p2', variantId: null, quantity: 1, maxStock: 3 },
    ],
    [
      { productId: 'p1', variantId: 'v1', quantity: 4, maxStock: 5 },
      { productId: 'p1', variantId: 'v2', quantity: 1, maxStock: 4 },
    ],
  );
  assert.equal(merged.length, 3);
  assert.equal(merged.find((x) => x.variantId === 'v1')?.quantity, 5);
  assert.equal(merged.find((x) => x.variantId === 'v2')?.quantity, 1);
});

test('Order totals prevent negative amounts', () => {
  const totals = calculateOrderTotals({
    items: [{ productId: 'p1', quantity: 1, unitPrice: 500 }],
    couponDiscount: 900,
    shippingCharge: 60,
  });
  assert.equal(totals.subtotal, 500);
  assert.equal(totals.discount, 500);
  assert.equal(totals.total, 60);
});

test('Order state machine blocks illegal transitions and unpaid online fulfillment', () => {
  assert.equal(
    canTransitionOrderStatus({
      currentStatus: 'pending',
      nextStatus: 'delivered',
      paymentMethod: 'cod',
      paymentStatus: 'unpaid',
    }).allowed,
    false,
  );
  assert.equal(
    canTransitionOrderStatus({
      currentStatus: 'confirmed',
      nextStatus: 'processing',
      paymentMethod: 'sslcommerz',
      paymentStatus: 'pending',
    }).allowed,
    false,
  );
  assert.equal(
    canTransitionOrderStatus({
      currentStatus: 'confirmed',
      nextStatus: 'processing',
      paymentMethod: 'sslcommerz',
      paymentStatus: 'paid',
    }).allowed,
    true,
  );
  assert.equal(canCustomerCancelOrder('pending'), true);
  assert.equal(canCustomerCancelOrder('shipped'), false);
  assert.equal(canCustomerRequestReturn('delivered', new Date().toISOString()), true);
  assert.equal(computeAvailableStock(10, 4), 6);
  assert.equal(shouldRestoreStockOnCancel('confirmed', 'unpaid'), true);
});

test('Cross-lingual search expands Bangla queries into English catalog terms', () => {
  const expanded = expandCrossLingualTerms('মোটিভেশনাল বই');
  assert.ok(expanded.expandedTerms.includes('motivational books'));
  assert.ok(expanded.expandedTerms.includes('motivational'));
  assert.ok(expanded.expandedTerms.includes('books'));

  const segments = buildHighlightSegments('Atomic Habits Motivational Book', 'book');
  assert.ok(segments.some((s) => s.match && s.text.toLowerCase() === 'book'));
});

test('RBAC enforces least privilege per staff role', () => {
  assert.equal(hasPermission('customer', 'orders.view'), false);
  assert.equal(hasPermission('inventory_manager', 'inventory.adjust'), true);
  assert.equal(hasPermission('inventory_manager', 'staff.manage'), false);
  assert.equal(hasPermission('order_manager', 'payments.reconcile'), false);
  assert.equal(hasPermission('finance_accounts', 'refunds.manage'), true);
  assert.equal(hasPermission('super_admin', 'staff.manage'), true);
});

test('parseApiResponsePayload validates JSON, rejects HTML /api/* responses, and parses structured errors safely', () => {
  const valid = parseApiResponsePayload<{ ok: true; products: unknown[] }>({
    path: '/api/products',
    status: 200,
    ok: true,
    contentType: 'application/json; charset=utf-8',
    rawText: JSON.stringify({ ok: true, products: [{ id: '1' }] }),
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.products.length, 1);

  assert.throws(
    () =>
      parseApiResponsePayload({
        path: '/api/products',
        status: 200,
        ok: true,
        contentType: 'text/html; charset=utf-8',
        rawText: '<!doctype html><html><body>SPA</body></html>',
      }),
    (err: unknown) => err instanceof ApiError && err.code === 'INVALID_API_RESPONSE',
  );

  assert.throws(
    () =>
      parseApiResponsePayload({
        path: '/api/products',
        status: 502,
        ok: false,
        contentType: 'text/html',
        rawText: '<html>502 Bad Gateway</html>',
      }),
    (err: unknown) => err instanceof ApiError && err.status === 502 && err.code === 'HTTP_ERROR',
  );

  assert.throws(
    () =>
      parseApiResponsePayload({
        path: '/api/products',
        status: 200,
        ok: true,
        contentType: 'application/json',
        rawText: '{bad json',
      }),
    (err: unknown) => err instanceof ApiError && err.code === 'MALFORMED_JSON_RESPONSE',
  );

  assert.throws(
    () =>
      parseApiResponsePayload({
        path: '/api/products',
        status: 503,
        ok: false,
        contentType: 'application/json',
        rawText: JSON.stringify({ ok: false, code: 'DATABASE_UNAVAILABLE', error: 'Atlas offline' }),
      }),
    (err: unknown) => err instanceof ApiError && err.code === 'DATABASE_UNAVAILABLE' && err.message === 'Atlas offline',
  );
});

test('evaluateDiscountRules selects best eligible rule and respects minQty/minSpend/dates', () => {
  const now = new Date('2026-11-16T12:00:00Z');
  const items = [
    { productId: 'p1', quantity: 3, unitPrice: 1000 },
    { productId: 'p2', quantity: 1, unitPrice: 500 },
  ];
  const res = evaluateDiscountRules(
    [
      { name: 'Bulk 15%', ruleType: 'bulk', value: 15, minQty: 4, minSpend: 2000, isActive: true },
      { name: 'Flat 300', ruleType: 'fixed', value: 300, minQty: 1, minSpend: 1000, isActive: true },
      { name: 'Expired 50%', ruleType: 'percentage', value: 50, isActive: true, endsAt: '2026-11-01T00:00:00Z' },
    ],
    items,
    now,
  );
  assert.equal(res.discountAmount, 525);
  assert.equal(res.appliedRuleName, 'Bulk 15%');
});

test('calculateOrderTotals computes inclusive and exclusive tax accurately', () => {
  const exclusive = calculateOrderTotals({
    items: [{ productId: 'p1', quantity: 1, unitPrice: 1000 }],
    couponDiscount: 0,
    shippingCharge: 60,
    taxRate: 0.05,
    taxInclusive: false,
  });
  assert.equal(exclusive.tax, 50);
  assert.equal(exclusive.total, 1110);

  const inclusive = calculateOrderTotals({
    items: [{ productId: 'p1', quantity: 1, unitPrice: 1050 }],
    couponDiscount: 0,
    shippingCharge: 60,
    taxRate: 0.05,
    taxInclusive: true,
  });
  assert.equal(inclusive.tax, 50);
  assert.equal(inclusive.total, 1110);
});

test('RBAC enforces logs.view, system.view, and customPermissions overrides', () => {
  assert.equal(hasPermission('order_manager', 'logs.view'), false);
  assert.equal(hasPermission('super_admin', 'logs.view'), true);
  assert.equal(hasPermission('super_admin', 'system.view'), true);
  assert.equal(hasPermission('admin', 'system.view'), true);
  assert.equal(hasPermission('order_manager', 'system.view', ['system.view']), true);
});

test('dateTime helpers handle local datetime formatting, schedule windows, and currency positions', () => {
  assert.equal(toLocalDateTimeInputValue(null), '');
  assert.equal(toLocalDateTimeInputValue('invalid-date'), '');
  const formatted = toLocalDateTimeInputValue('2026-11-16T08:30:00');
  assert.match(formatted, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

  const now = new Date('2026-11-16T12:00:00Z');
  assert.equal(isWithinScheduleWindow(null, null, now), true);
  assert.equal(isWithinScheduleWindow('2026-11-15T00:00:00Z', '2026-11-17T00:00:00Z', now), true);
  assert.equal(isWithinScheduleWindow('2026-11-17T00:00:00Z', null, now), false);
  assert.equal(isWithinScheduleWindow(null, '2026-11-15T00:00:00Z', now), false);

  assert.equal(formatStoreCurrency(1250, { symbol: '৳', position: 'prefix' }), '৳1,250');
  assert.equal(formatStoreCurrency(1250, { symbol: 'BDT', position: 'suffix' }), '1,250 BDT');
});

test('calculateShippingCharge matches active deliveryZones and ignores inactive zones', () => {
  const zones = [
    {
      name: 'Disabled Zone',
      divisions: ['Sylhet'],
      charge: 999,
      freeAbove: 5000,
      estimatedDays: '10 days',
      isActive: false,
    },
    {
      name: 'Sylhet Hub',
      divisions: ['Sylhet'],
      charge: 95,
      freeAbove: 1500,
      estimatedDays: '2 days',
      isActive: true,
    },
    {
      name: 'Fallback All',
      divisions: ['All'],
      charge: 110,
      freeAbove: 2000,
      estimatedDays: '4 days',
      isActive: true,
    },
  ];

  const sylhetUnder = calculateShippingCharge({
    division: 'Sylhet',
    district: 'Sylhet',
    upazila: 'Sylhet Sadar',
    subtotal: 1200,
    deliveryZones: zones,
  });
  assert.equal(sylhetUnder.charge, 95);
  assert.equal(sylhetUnder.zoneName, 'Sylhet Hub');
  assert.equal(sylhetUnder.estimatedDays, '2 days');
  assert.equal(sylhetUnder.freeShippingApplied, false);

  const sylhetFree = calculateShippingCharge({
    division: 'Sylhet',
    district: 'Sylhet',
    upazila: 'Sylhet Sadar',
    subtotal: 1500,
    deliveryZones: zones,
  });
  assert.equal(sylhetFree.charge, 0);
  assert.equal(sylhetFree.freeShippingApplied, true);

  const khulnaFallback = calculateShippingCharge({
    division: 'Khulna',
    district: 'Khulna',
    upazila: 'Sonadanga',
    subtotal: 1000,
    deliveryZones: zones,
  });
  assert.equal(khulnaFallback.charge, 110);
  assert.equal(khulnaFallback.zoneName, 'Fallback All');
});


