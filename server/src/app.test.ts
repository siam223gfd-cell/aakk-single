import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createExpressApp } from './app';
import {
  buildCategoryAncestryPath,
  buildProductCatalogFilter,
  collectDescendantCategoryIds,
  enrichProductPricing,
  getCatalogSortSpec,
} from './modules/products/productCatalogHelpers';
import { heroSlideSchema } from './modules/hero-slides/heroSlide.validation';
import { bannerSchema, bannerStatusSchema, bannerReorderSchema } from './modules/banners/banner.validation';
import { homepageConfigPatchSchema } from './modules/cms/cmsSettings.validation';
import {
  homepageLayoutSectionSchema,
  homepageLayoutUpdateSchema,
  homepageSectionReorderSchema,
} from './modules/cms/homepageLayout.validation';
import { getAuthCookieOptions, setAuthCookie, logoutController } from './modules/auth/auth.controller';
import { authenticateRequired, requirePermission, signAuthToken, type AuthenticatedRequest } from './middleware/auth.middleware';
import { UserModel } from './modules/users/user.model';

async function withTestServer(fn: (baseUrl: string) => Promise<void>) {
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('API health reports database disconnected honestly when Atlas is not configured', async () => {
  await withTestServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/health`);
    const body = (await res.json()) as { ok: boolean; database: string; integrations: Record<string, boolean> };
    assert.equal(res.status, 503);
    assert.equal(body.ok, false);
    assert.equal(body.database, 'disconnected');
    assert.equal(typeof body.integrations.cloudinary, 'boolean');

    // When proxied behind container nginx (with X-Forwarded-Host), status maps to proxy-passthrough 424 JSON
    const prevNginxPort = process.env.NGINX_PORT;
    process.env.NGINX_PORT = '8080';
    try {
      const proxiedRes = await fetch(`${baseUrl}/api/health`, {
        headers: { 'X-Forwarded-Host': 'ais-dev-example.run.app' },
      });
      const proxiedBody = (await proxiedRes.json()) as { ok: boolean; database: string };
      assert.equal(proxiedRes.status, 424);
      assert.equal(proxiedRes.headers.get('x-origin-status'), '503');
      assert.equal(proxiedRes.headers.get('content-type')?.includes('application/json'), true);
      assert.equal(proxiedBody.ok, false);
      assert.equal(proxiedBody.database, 'disconnected');
    } finally {
      if (prevNginxPort === undefined) {
        delete process.env.NGINX_PORT;
      } else {
        process.env.NGINX_PORT = prevNginxPort;
      }
    }
  });
});

test('Unknown /api and /api/* routes plus malformed JSON return structured JSON rather than HTML', async () => {
  await withTestServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    const body = (await res.json()) as { ok: boolean; code: string };
    assert.equal(res.status, 404);
    assert.equal(res.headers.get('content-type')?.includes('application/json'), true);
    assert.equal(body.ok, false);
    assert.equal(body.code, 'API_NOT_FOUND');

    const rootApiRes = await fetch(`${baseUrl}/api`);
    const rootBody = (await rootApiRes.json()) as { ok: boolean; code: string };
    assert.equal(rootApiRes.status, 404);
    assert.equal(rootApiRes.headers.get('content-type')?.includes('application/json'), true);
    assert.equal(rootBody.ok, false);
    assert.equal(rootBody.code, 'API_NOT_FOUND');

    const badJsonRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email":',
    });
    const badJsonBody = (await badJsonRes.json()) as { ok: boolean; code: string };
    assert.equal(badJsonRes.status, 400);
    assert.equal(badJsonRes.headers.get('content-type')?.includes('application/json'), true);
    assert.equal(badJsonBody.ok, false);
    assert.equal(badJsonBody.code, 'INVALID_JSON_BODY');
  });
});

test('Catalog and storefront API routes return JSON with no-store Cache-Control and never hijack SPA /pages/:slug', async () => {
  await withTestServer(async (baseUrl) => {
    const prodRes = await fetch(`${baseUrl}/api/products`);
    assert.equal(prodRes.status, 503);
    assert.ok(prodRes.headers.get('content-type')?.includes('application/json'));
    assert.ok(prodRes.headers.get('cache-control')?.includes('no-store'));

    const homeRes = await fetch(`${baseUrl}/api/storefront/homepage`);
    assert.equal(homeRes.status, 503);
    assert.ok(homeRes.headers.get('content-type')?.includes('application/json'));
    assert.ok(homeRes.headers.get('cache-control')?.includes('no-store'));

    // /pages/about-us must NOT be intercepted by Express JSON storefrontRoutes at root
    const spaPageRes = await fetch(`${baseUrl}/pages/about-us`);
    assert.equal(spaPageRes.status, 404);

    // /api/storefront/pages/about-us hits the API route
    const apiPageRes = await fetch(`${baseUrl}/api/storefront/pages/about-us`);
    assert.equal(apiPageRes.status, 503);
    assert.ok(apiPageRes.headers.get('content-type')?.includes('application/json'));
  });
});

test('Protected checkout and admin endpoints fail closed when DB/auth is unavailable', async () => {
  await withTestServer(async (baseUrl) => {
    const checkoutRes = await fetch(`${baseUrl}/api/orders/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.ok(checkoutRes.status === 401 || checkoutRes.status === 503);

    const adminRes = await fetch(`${baseUrl}/api/admin/overview`);
    assert.ok(adminRes.status === 401 || adminRes.status === 503);
  });
});

test('SEO robots.txt and sitemap.xml return expected content types', async () => {
  await withTestServer(async (baseUrl) => {
    const robots = await fetch(`${baseUrl}/robots.txt`);
    const robotsText = await robots.text();
    assert.equal(robots.status, 200);
    assert.ok(robotsText.includes('Disallow: /admin'));
    assert.ok(robotsText.includes('Sitemap:'));

    const sitemap = await fetch(`${baseUrl}/sitemap.xml`);
    const xml = await sitemap.text();
    assert.equal(sitemap.status, 200);
    assert.ok(xml.includes('<urlset'));
  });
});

test('Product catalog helpers handle category ancestry, variant stock, discount filters, and sorting', () => {
  const categories = [
    { _id: 'c1', slug: 'electronics', parentId: null },
    { _id: 'c2', slug: 'mobiles-tablets', parentId: 'c1' },
    { _id: 'c3', slug: 'android-phones', parentId: 'c2' },
  ];

  const descendants = collectDescendantCategoryIds('c1', categories);
  assert.deepEqual(descendants, ['c1', 'c2', 'c3']);

  const path = buildCategoryAncestryPath({
    categoryId: 'c2',
    subCategoryId: 'c3',
    allCategories: categories,
  });
  assert.ok(path.includes('electronics'));
  assert.ok(path.includes('mobiles-tablets'));
  assert.ok(path.includes('android-phones'));

  const filter = buildProductCatalogFilter({
    categoryIds: ['c1', 'c2'],
    inStockOnly: true,
    discountOnly: true,
    section: 'featured',
  });
  assert.equal(filter.status, 'published');
  assert.ok(Array.isArray(filter.$and) && filter.$and.length >= 4);

  const enriched = enrichProductPricing({
    _id: 'p1',
    basePrice: 1000,
    salePrice: 800,
    stockOnHand: 0,
    reservedStock: 0,
    hasVariants: true,
    variants: [
      { stockOnHand: 5, reservedStock: 2, isActive: true },
      { stockOnHand: 10, reservedStock: 0, isActive: false },
    ],
    categoryId: { _id: 'c2', name: 'Mobiles', slug: 'mobiles-tablets' },
  });
  assert.equal(enriched.id, 'p1');
  assert.equal(enriched.currentPrice, 800);
  assert.equal(enriched.originalPrice, 1000);
  assert.equal(enriched.discountPercent, 20);
  assert.equal(enriched.availableStock, 3);

  assert.deepEqual(getCatalogSortSpec('price_asc'), { _effectivePrice: 1, createdAt: -1 });
  assert.deepEqual(getCatalogSortSpec('newest'), { createdAt: -1 });
});

test('Extended admin & storefront JSON endpoints handle DB disconnection cleanly without HTML leaks', async () => {
  await withTestServer(async (baseUrl) => {
    for (const path of [
      '/api/admin/system-health',
      '/api/admin/logs',
      '/api/admin/customer-groups',
      '/api/admin/promotions/rules',
      '/api/storefront/offers',
      '/api/storefront/blogs',
      '/api/storefront/faqs',
    ]) {
      const res = await fetch(`${baseUrl}${path}`);
      assert.ok(res.status === 401 || res.status === 503, `Expected 401/503 for ${path}, got ${res.status}`);
      assert.ok(res.headers.get('content-type')?.includes('application/json'), `Expected JSON for ${path}`);
    }

    const visitRes = await fetch(`${baseUrl}/api/storefront/analytics/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionKey: 'test-session-1234', path: '/' }),
    });
    assert.equal(visitRes.status, 200);
    const visitBody = (await visitRes.json()) as { ok: boolean; recorded: boolean };
    assert.equal(visitBody.ok, true);
    assert.equal(visitBody.recorded, false);
  });
});

test('Dedicated /api/auth/admin/login and modular admin endpoints fail closed as structured JSON', async () => {
  await withTestServer(async (baseUrl) => {
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'cm@gmail.com', password: 'demo-check-password' }),
    });
    assert.equal(adminLoginRes.status, 503);
    assert.ok(adminLoginRes.headers.get('content-type')?.includes('application/json'));
    const adminLoginBody = (await adminLoginRes.json()) as { ok: boolean; code: string };
    assert.equal(adminLoginBody.ok, false);
    assert.equal(adminLoginBody.code, 'DATABASE_UNAVAILABLE');

    for (const endpoint of [
      '/api/admin/hero-slides',
      '/api/admin/banners',
      '/api/admin/products/507f1f77bcf86cd799439011',
      '/api/admin/reviews/507f1f77bcf86cd799439011',
      '/api/admin/orders/507f1f77bcf86cd799439011',
      '/api/admin/customers/507f1f77bcf86cd799439011',
      '/api/admin/staff',
      '/api/admin/roles',
      '/api/admin/audit-logs',
    ]) {
      const res = await fetch(`${baseUrl}${endpoint}`);
      assert.ok(res.status === 401 || res.status === 503, `Expected 401/503 for ${endpoint}, got ${res.status}`);
      assert.ok(res.headers.get('content-type')?.includes('application/json'), `Expected JSON for ${endpoint}`);
    }
  });
});

test('Zod validation schemas enforce strict allowlists for hero slides, banners, and CMS settings', () => {
  const validSlide = heroSlideSchema.safeParse({
    badgeText: 'New Launch',
    heading: 'Smart Technology',
    headlineLine2: 'Better Life',
    subtitle: 'Curated tech for Dhaka and nationwide',
    desktopImageUrl: 'https://cdn.example.com/hero.jpg',
    mobileImageUrl: '/assets/hero-mobile.jpg',
    ctaText: 'Shop Now',
    ctaUrl: '/shop',
    sortOrder: 1,
    isActive: true,
  });
  assert.equal(validSlide.success, true);

  const invalidSlideUrl = heroSlideSchema.safeParse({
    heading: 'Test Slide',
    desktopImageUrl: 'https://cdn.example.com/hero.jpg',
    ctaUrl: 'javascript:alert(1)',
  });
  assert.equal(invalidSlideUrl.success, false);

  const validBanner = bannerSchema.safeParse({
    title: 'Big Winter Sale',
    desktopImageUrl: 'https://cdn.example.com/banner.jpg',
    placement: 'hero_bento',
    theme: 'royal-blue',
    ctaText: 'Explore',
    destinationUrl: '/shop?discount=true',
    priority: 10,
    isPublished: true,
  });
  assert.equal(validBanner.success, true);

  const validSettingsPatch = homepageConfigPatchSchema.safeParse({
    storeInfo: {
      storeName: 'NOVARA COMMERCE',
      tagline: 'Smart Tech Store',
      description: 'Premium store',
      supportPhone: '+8801700000000',
      supportEmail: 'support@novara.com',
    },
  });
  assert.equal(validSettingsPatch.success, true);

  const strictRejected = homepageConfigPatchSchema.safeParse({
    _id: '507f1f77bcf86cd799439011',
    __v: 0,
    storeInfo: { storeName: 'NOVARA' },
  });
  assert.equal(strictRejected.success, false);
});

test('Auth cookies use SameSite=None; Secure behind HTTPS proxy and SameSite=Lax on plain HTTP', () => {
  const httpsReq = {
    secure: false,
    get: (name: string) => (name.toLowerCase() === 'x-forwarded-proto' ? 'https' : undefined),
  } as unknown as Parameters<typeof getAuthCookieOptions>[0];
  const httpsOpts = getAuthCookieOptions(httpsReq);
  assert.equal(httpsOpts.httpOnly, true);
  assert.equal(httpsOpts.sameSite, 'none');
  assert.equal(httpsOpts.secure, true);

  const httpReq = {
    secure: false,
    get: () => undefined,
  } as unknown as Parameters<typeof getAuthCookieOptions>[0];
  const httpOpts = getAuthCookieOptions(httpReq);
  assert.equal(httpOpts.httpOnly, true);
  assert.equal(httpOpts.sameSite, 'lax');
  assert.equal(httpOpts.secure, false);

  const captured: Array<{ name: string; val?: string; opts: Record<string, unknown> }> = [];
  const mockRes = {
    cookie: (name: string, val: string, opts: Record<string, unknown>) => captured.push({ name, val, opts }),
    clearCookie: (name: string, opts: Record<string, unknown>) => captured.push({ name, opts }),
    json: () => undefined,
  } as unknown as Parameters<typeof setAuthCookie>[1];

  setAuthCookie(httpsReq, mockRes, 'jwt-sample');
  assert.equal(captured[0].name, 'novara_token');
  assert.equal(captured[0].opts.sameSite, 'none');
  assert.equal(captured[0].opts.secure, true);

  logoutController(httpsReq, mockRes);
  assert.equal(captured[1].name, 'novara_token');
  assert.equal(captured[1].opts.sameSite, 'none');
  assert.equal(captured[1].opts.secure, true);
});

test('Helmet permits embedded iframe preview and cross-origin asset loading', async () => {
  await withTestServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.headers.get('x-frame-options'), null);
    assert.equal(res.headers.get('cross-origin-resource-policy'), 'cross-origin');
  });
});

test('authenticateRequired and requirePermission enforce JWT Bearer authentication and role RBAC', async () => {
  const originalFindById = UserModel.findById;
  try {
    // 1. Missing token -> 401 UNAUTHENTICATED
    let statusCode = 0;
    let payload: Record<string, unknown> = {};
    const makeRes = () =>
      ({
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(body: Record<string, unknown>) {
          payload = body;
          return this;
        },
      }) as unknown as Parameters<typeof authenticateRequired>[1];

    await authenticateRequired(
      { cookies: {}, headers: {} } as unknown as AuthenticatedRequest,
      makeRes(),
      () => undefined,
    );
    assert.equal(statusCode, 401);
    assert.equal(payload.code, 'UNAUTHENTICATED');

    // 2. Valid Bearer token -> resolves user; RBAC differentiates super_admin vs customer
    const adminUser = {
      _id: '507f1f77bcf86cd799439011',
      role: 'super_admin' as const,
      email: 'admin@novara.test',
      status: 'active',
      customPermissions: [],
    };
    const customerUser = {
      _id: '507f1f77bcf86cd799439012',
      role: 'customer' as const,
      email: 'customer@novara.test',
      status: 'active',
      customPermissions: [],
    };
    UserModel.findById = (async (id: unknown) =>
      String(id) === adminUser._id ? adminUser : String(id) === customerUser._id ? customerUser : null) as never;

    const adminReq = {
      cookies: {},
      headers: { authorization: `Bearer ${signAuthToken(adminUser)}` },
    } as unknown as AuthenticatedRequest;
    let nextCalled = false;
    await authenticateRequired(adminReq, makeRes(), () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(adminReq.user?.role, 'super_admin');

    let adminPermGranted = false;
    requirePermission('catalog.manage')(adminReq, makeRes(), () => {
      adminPermGranted = true;
    });
    assert.equal(adminPermGranted, true);

    const custReq = {
      cookies: {},
      headers: { authorization: `Bearer ${signAuthToken(customerUser)}` },
    } as unknown as AuthenticatedRequest;
    await authenticateRequired(custReq, makeRes(), () => undefined);

    statusCode = 0;
    payload = {};
    let custPermGranted = false;
    requirePermission('catalog.manage')(custReq, makeRes(), () => {
      custPermGranted = true;
    });
    assert.equal(custPermGranted, false);
    assert.equal(statusCode, 403);
    assert.equal(payload.code, 'FORBIDDEN');

    // 3. cms.manage permission check differentiates super_admin vs customer
    let cmsAdminGranted = false;
    requirePermission('cms.manage')(adminReq, makeRes(), () => {
      cmsAdminGranted = true;
    });
    assert.equal(cmsAdminGranted, true);

    statusCode = 0;
    payload = {};
    let cmsCustGranted = false;
    requirePermission('cms.manage')(custReq, makeRes(), () => {
      cmsCustGranted = true;
    });
    assert.equal(cmsCustGranted, false);
    assert.equal(statusCode, 403);
    assert.equal(payload.code, 'FORBIDDEN');
  } finally {
    UserModel.findById = originalFindById;
  }
});

test('Dynamic Banner Builder schemas allow solid/gradient without images and enforce conditional rules', () => {
  const solidBanner = bannerSchema.safeParse({
    title: 'Flash Tech Deals',
    subtitle: 'Up to 30% off audio',
    backgroundType: 'solid',
    backgroundColor: '#145CFF',
    backgroundOpacity: 95,
    placement: 'above_featured',
    widthMode: 'half',
    displayOrder: 2,
    status: 'draft',
    isPublished: false,
  });
  assert.equal(solidBanner.success, true);

  const gradientBanner = bannerSchema.safeParse({
    title: 'Weekend Gradient Showcase',
    backgroundType: 'gradient',
    gradientConfig: {
      type: 'linear',
      angle: 135,
      stops: [
        { color: '#145CFF', position: 0 },
        { color: '#0A2DFF', position: 100 },
      ],
      opacity: 90,
    },
    placement: 'below_categories',
    ctaText: 'Explore',
    destinationUrl: '/shop',
  });
  assert.equal(gradientBanner.success, true);

  const imageMissingUrl = bannerSchema.safeParse({
    title: 'Missing Image Banner',
    backgroundType: 'image_overlay',
    desktopImageUrl: '',
    placement: 'hero_bento',
  });
  assert.equal(imageMissingUrl.success, false);

  const badDestination = bannerSchema.safeParse({
    title: 'Unsafe Banner',
    backgroundType: 'solid',
    destinationUrl: 'javascript:alert(1)',
  });
  assert.equal(badDestination.success, false);

  const invertedDates = bannerSchema.safeParse({
    title: 'Bad Schedule',
    backgroundType: 'solid',
    startsAt: '2026-12-10T00:00:00.000Z',
    endsAt: '2026-12-01T00:00:00.000Z',
  });
  assert.equal(invertedDates.success, false);

  assert.equal(bannerStatusSchema.safeParse({ status: 'published' }).success, true);
  assert.equal(bannerStatusSchema.safeParse({ status: 'archived' }).success, false);

  assert.equal(
    bannerReorderSchema.safeParse({
      items: [
        { id: 'b1', displayOrder: 1 },
        { id: 'b2', displayOrder: 2 },
      ],
    }).success,
    true,
  );
  assert.equal(bannerReorderSchema.safeParse({ items: [] }).success, false);
});

test('Homepage Layout schemas validate sections, URLs, product sources, and reorder payloads', () => {
  const validSection = homepageLayoutSectionSchema.safeParse({
    sectionId: 'dynamic_banner_mid',
    sectionType: 'dynamic_banner',
    title: 'Mid-Page Feature Banner',
    enabled: true,
    displayOrder: 4,
    widthMode: 'full',
    sourceReferences: {
      productSourceMode: 'featured',
      productIds: [],
      productCount: 8,
      sortBy: 'popular',
      bannerPlacement: 'above_featured',
      bannerIds: ['507f1f77bcf86cd799439011'],
    },
  });
  assert.equal(validSection.success, true);

  const invalidType = homepageLayoutSectionSchema.safeParse({
    sectionId: 'bad_sec',
    sectionType: 'unknown_widget',
    title: 'Bad Section',
  });
  assert.equal(invalidType.success, false);

  const invalidCtaUrl = homepageLayoutSectionSchema.safeParse({
    sectionId: 'bad_url',
    sectionType: 'custom_content',
    title: 'Custom Content',
    contentSettings: {
      ctaUrl: 'javascript:void(0)',
    },
  });
  assert.equal(invalidCtaUrl.success, false);

  assert.equal(
    homepageLayoutUpdateSchema.safeParse({
      name: 'Default Homepage',
      sections: [
        {
          sectionId: 'hero_slider',
          sectionType: 'hero_slider',
          title: 'Hero Slider',
          displayOrder: 0,
        },
      ],
    }).success,
    true,
  );

  assert.equal(
    homepageSectionReorderSchema.safeParse({
      order: [
        { sectionId: 'hero_slider', displayOrder: 0 },
        { sectionId: 'featured_products', displayOrder: 1 },
      ],
    }).success,
    true,
  );
});

test('Public /api/homepage/* and admin banner/layout endpoints enforce JSON + no-store and fail closed', async () => {
  await withTestServer(async (baseUrl) => {
    for (const publicPath of ['/api/homepage/layout', '/api/homepage/banners']) {
      const res = await fetch(`${baseUrl}${publicPath}`);
      assert.equal(res.status, 503, `Expected 503 for ${publicPath} when DB offline`);
      assert.ok(res.headers.get('content-type')?.includes('application/json'), `Expected JSON for ${publicPath}`);
      assert.ok(res.headers.get('cache-control')?.includes('no-store'), `Expected no-store for ${publicPath}`);
    }

    const adminEndpoints = [
      { method: 'PATCH', path: '/api/admin/banners/reorder', body: { items: [{ id: 'b1', displayOrder: 1 }] } },
      { method: 'PATCH', path: '/api/admin/banners/507f1f77bcf86cd799439011/status', body: { status: 'published' } },
      { method: 'POST', path: '/api/admin/banners/507f1f77bcf86cd799439011/duplicate' },
      { method: 'POST', path: '/api/admin/banners/media/upload' },
      { method: 'GET', path: '/api/admin/homepage-layout' },
      { method: 'POST', path: '/api/admin/homepage-layout/publish' },
    ];

    for (const ep of adminEndpoints) {
      const res = await fetch(`${baseUrl}${ep.path}`, {
        method: ep.method,
        headers: ep.body ? { 'Content-Type': 'application/json' } : undefined,
        body: ep.body ? JSON.stringify(ep.body) : undefined,
      });
      assert.ok(res.status === 401 || res.status === 503, `Expected 401/503 for ${ep.method} ${ep.path}, got ${res.status}`);
      assert.ok(res.headers.get('content-type')?.includes('application/json'));
    }
  });
});




