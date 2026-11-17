import { OrderModel } from '../orders/order.model';
import { ProductModel } from '../products/product.model';
import { UserModel } from '../users/user.model';
import { ReviewModel } from '../reviews/review.model';
import { HomepageConfigModel } from '../cms/cms.model';
import { AuditLogModel, SiteVisitModel, SupportEnquiryModel } from '../support/support.model';

function calcTrendPct(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function buildDailyBuckets(days: number, now: Date): Array<{ key: string; label: string; date: Date }> {
  const buckets: Array<{ key: string; label: string; date: Date }> = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    buckets.push({ key, label, date: d });
  }
  return buckets;
}

export async function getAdminOverviewData(days: number, revRange: string) {
  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const prevSince = new Date(since.getTime() - days * 24 * 60 * 60 * 1000);

  const revDays = revRange === 'week' ? 7 : revRange === 'year' ? 365 : 30;
  const revSince = new Date(now.getTime() - revDays * 24 * 60 * 60 * 1000);

  const [
    ordersInWindow,
    prevOrdersCount,
    prevOrdersRevenueAgg,
    allOrdersCount,
    allCustomersCount,
    customersInWindow,
    prevCustomersCount,
    activeProductsCount,
    totalReviewsCount,
    pendingReviewsCount,
    visitorsInWindow,
    prevVisitorsCount,
    dailyVisits,
    pendingOrdersCount,
    lowStockProducts,
    outOfStockCount,
    recentOrders,
    topProductsRaw,
    recentAudit,
    statusCountsRaw,
    cmsConfig,
    openEnquiriesCount,
    revOrdersRaw,
  ] = await Promise.all([
    OrderModel.find({ createdAt: { $gte: since } }).select('total orderStatus paymentStatus paymentMethod createdAt').lean(),
    OrderModel.countDocuments({ createdAt: { $gte: prevSince, $lt: since } }),
    OrderModel.aggregate([
      { $match: { createdAt: { $gte: prevSince, $lt: since }, orderStatus: { $nin: ['cancelled', 'returned'] } } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
    OrderModel.countDocuments(),
    UserModel.countDocuments({ role: 'customer' }),
    UserModel.find({ role: 'customer', createdAt: { $gte: since } }).select('createdAt').lean(),
    UserModel.countDocuments({ role: 'customer', createdAt: { $gte: prevSince, $lt: since } }),
    ProductModel.countDocuments({ status: 'published' }),
    ReviewModel.countDocuments(),
    ReviewModel.countDocuments({ status: 'pending' }),
    SiteVisitModel.countDocuments({ createdAt: { $gte: since } }),
    SiteVisitModel.countDocuments({ createdAt: { $gte: prevSince, $lt: since } }),
    SiteVisitModel.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]),
    OrderModel.countDocuments({ orderStatus: { $in: ['pending', 'confirmed', 'processing', 'packed'] } }),
    ProductModel.find({
      status: 'published',
      $expr: { $lte: [{ $subtract: ['$stockOnHand', '$reservedStock'] }, '$lowStockThreshold'] },
    })
      .select('name sku stockOnHand reservedStock lowStockThreshold images')
      .limit(12)
      .lean(),
    ProductModel.countDocuments({
      status: 'published',
      $expr: { $lte: [{ $subtract: ['$stockOnHand', '$reservedStock'] }, 0] },
    }),
    OrderModel.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .select('orderNumber customerName customerEmail total orderStatus paymentStatus createdAt')
      .lean(),
    ProductModel.find({ status: 'published' })
      .sort({ soldCount: -1, ratingAverage: -1 })
      .limit(5)
      .select('name slug sku soldCount stockOnHand reservedStock basePrice salePrice images')
      .lean(),
    AuditLogModel.find().sort({ createdAt: -1 }).limit(10).lean(),
    OrderModel.aggregate([{ $group: { _id: '$orderStatus', count: { $sum: 1 } } }]),
    HomepageConfigModel.findOne({ key: 'main' }).select('contactInfo footerSettings maintenanceMode').lean(),
    SupportEnquiryModel.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
    OrderModel.find({ createdAt: { $gte: revSince }, orderStatus: { $nin: ['cancelled'] } })
      .select('total orderStatus createdAt')
      .lean(),
  ]);

  let grossSales = 0;
  let netSales = 0;
  let cancelledCount = 0;
  let returnedCount = 0;
  let paidTotal = 0;
  let codPendingTotal = 0;

  for (const o of ordersInWindow) {
    grossSales += o.total;
    if (o.orderStatus === 'cancelled') cancelledCount += 1;
    if (o.orderStatus === 'returned' || o.orderStatus === 'return_requested') returnedCount += 1;
    if (o.orderStatus !== 'cancelled' && o.orderStatus !== 'returned') {
      netSales += o.total;
    }
    if (o.paymentStatus === 'paid') paidTotal += o.total;
    if (o.paymentMethod === 'cod' && o.paymentStatus === 'unpaid' && o.orderStatus !== 'cancelled') {
      codPendingTotal += o.total;
    }
  }

  const activeOrderCount = ordersInWindow.filter((o) => o.orderStatus !== 'cancelled').length;
  const avgOrderValue = activeOrderCount > 0 ? Math.round(netSales / activeOrderCount) : 0;
  const prevRevenue = Number(prevOrdersRevenueAgg[0]?.total || 0);

  const statusMap = new Map<string, number>();
  for (const row of statusCountsRaw) {
    statusMap.set(String(row._id), Number(row.count));
  }
  const completedTotal = statusMap.get('delivered') || 0;
  const pendingTotal =
    (statusMap.get('pending') || 0) +
    (statusMap.get('confirmed') || 0) +
    (statusMap.get('processing') || 0) +
    (statusMap.get('packed') || 0) +
    (statusMap.get('shipped') || 0);
  const cancelledAllTotal = statusMap.get('cancelled') || 0;
  const refundedAllTotal = (statusMap.get('returned') || 0) + (statusMap.get('return_requested') || 0);
  const donutDenom = Math.max(1, completedTotal + pendingTotal + cancelledAllTotal + refundedAllTotal);

  const orderStatusBreakdown = {
    totalOrders: allOrdersCount,
    segments: [
      { key: 'completed', label: 'Completed', count: completedTotal, percent: allOrdersCount > 0 ? Number(((completedTotal / donutDenom) * 100).toFixed(1)) : 0, color: '#145CFF' },
      { key: 'pending', label: 'Pending', count: pendingTotal, percent: allOrdersCount > 0 ? Number(((pendingTotal / donutDenom) * 100).toFixed(1)) : 0, color: '#F59E0B' },
      { key: 'cancelled', label: 'Cancelled', count: cancelledAllTotal, percent: allOrdersCount > 0 ? Number(((cancelledAllTotal / donutDenom) * 100).toFixed(1)) : 0, color: '#EF4444' },
      { key: 'refunded', label: 'Refunded', count: refundedAllTotal, percent: allOrdersCount > 0 ? Number(((refundedAllTotal / donutDenom) * 100).toFixed(1)) : 0, color: '#CBD5E1' },
    ],
  };

  const buckets = buildDailyBuckets(Math.min(days, 30), now);
  const orderDaySales = new Map<string, { revenue: number; orders: number }>();
  for (const o of ordersInWindow) {
    const k = new Date(o.createdAt).toISOString().slice(0, 10);
    const cur = orderDaySales.get(k) || { revenue: 0, orders: 0 };
    cur.orders += 1;
    if (o.orderStatus !== 'cancelled' && o.orderStatus !== 'returned') {
      cur.revenue += o.total;
    }
    orderDaySales.set(k, cur);
  }

  const custDayCounts = new Map<string, number>();
  for (const c of customersInWindow) {
    const k = new Date(c.createdAt).toISOString().slice(0, 10);
    custDayCounts.set(k, (custDayCounts.get(k) || 0) + 1);
  }

  const visitDayMap = new Map<string, number>();
  for (const v of dailyVisits) {
    visitDayMap.set(String(v._id), Number(v.count || 0));
  }

  const salesSeries = buckets.map((b) => {
    const oData = orderDaySales.get(b.key) || { revenue: 0, orders: 0 };
    return {
      date: b.key,
      label: b.label,
      revenue: oData.revenue,
      orders: oData.orders,
      customers: custDayCounts.get(b.key) || 0,
      visitors: visitDayMap.get(b.key) || 0,
    };
  });

  let revenueSeries: Array<{ label: string; revenue: number; orders: number }> = [];
  let revenueOverviewTotal = 0;
  if (revRange === 'year') {
    const monthBuckets = new Map<string, { label: string; revenue: number; orders: number }>();
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      monthBuckets.set(key, { label, revenue: 0, orders: 0 });
    }
    for (const o of revOrdersRaw) {
      const d = new Date(o.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = monthBuckets.get(key);
      if (bucket) {
        bucket.revenue += o.total;
        bucket.orders += 1;
      }
      revenueOverviewTotal += o.total;
    }
    revenueSeries = Array.from(monthBuckets.values());
  } else {
    const barDays = revRange === 'week' ? 7 : 14;
    const barBuckets = buildDailyBuckets(barDays, now);
    const dayMap = new Map<string, { revenue: number; orders: number }>();
    for (const o of revOrdersRaw) {
      const key = new Date(o.createdAt).toISOString().slice(0, 10);
      const cur = dayMap.get(key) || { revenue: 0, orders: 0 };
      cur.revenue += o.total;
      cur.orders += 1;
      dayMap.set(key, cur);
      revenueOverviewTotal += o.total;
    }
    revenueSeries = barBuckets.map((b) => ({
      label: b.label,
      revenue: dayMap.get(b.key)?.revenue || 0,
      orders: dayMap.get(b.key)?.orders || 0,
    }));
  }

  const sparkSlice = salesSeries.slice(-10);

  return {
    periodDays: days,
    metrics: {
      grossSales,
      netSales,
      orderCount: ordersInWindow.length,
      totalOrdersAllTime: allOrdersCount,
      ordersTrendPct: calcTrendPct(ordersInWindow.length, prevOrdersCount),
      totalCustomers: allCustomersCount,
      customersTrendPct: calcTrendPct(customersInWindow.length, prevCustomersCount),
      revenueTrendPct: calcTrendPct(netSales, prevRevenue),
      activeProducts: activeProductsCount,
      visitors30d: visitorsInWindow,
      visitorsTrendPct: calcTrendPct(visitorsInWindow, prevVisitorsCount),
      pendingReviews: pendingReviewsCount,
      totalReviews: totalReviewsCount,
      activeOrderCount,
      avgOrderValue,
      pendingOrders: pendingOrdersCount,
      lowStockCount: lowStockProducts.length,
      outOfStockCount,
      cancelledCount,
      returnedCount,
      paidTotal,
      codPendingTotal,
      openEnquiriesCount,
    },
    sparklines: {
      orders: sparkSlice.map((s) => s.orders),
      customers: sparkSlice.map((s) => s.customers),
      revenue: sparkSlice.map((s) => s.revenue),
      products: sparkSlice.map(() => activeProductsCount),
      visitors: sparkSlice.map((s) => s.visitors),
      reviews: sparkSlice.map(() => pendingReviewsCount),
    },
    salesSeries,
    orderStatusBreakdown,
    recentOrders: recentOrders.map((o) => ({ ...o, id: String(o._id) })),
    revenueOverview: {
      total: revenueOverviewTotal,
      trendPct: calcTrendPct(netSales, prevRevenue),
      range: revRange,
      series: revenueSeries,
    },
    topProducts: topProductsRaw.map((p) => ({
      id: String(p._id),
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      soldCount: p.soldCount || 0,
      availableStock: Math.max(0, (p.stockOnHand || 0) - (p.reservedStock || 0)),
      price: p.salePrice ?? p.basePrice,
      imageUrl: p.images?.[0]?.url || '',
    })),
    footerSummary: {
      contactInfo: cmsConfig?.contactInfo || {},
      copyrightText: cmsConfig?.footerSettings?.copyrightText || '© 2026 NOVARA. All Rights Reserved.',
      storeStatus: cmsConfig?.maintenanceMode?.enabled ? 'maintenance' : cmsConfig?.footerSettings?.storeStatus || 'live',
    },
    lowStockProducts,
    recentAudit,
  };
}

export async function searchAdminEntities(q: string) {
  if (q.length < 2) {
    return { products: [], orders: [], customers: [] };
  }
  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  const [products, orders, customers] = await Promise.all([
    ProductModel.find({ $or: [{ name: regex }, { sku: regex }, { brandName: regex }] })
      .select('name sku basePrice salePrice status images')
      .limit(5)
      .lean(),
    OrderModel.find({ $or: [{ orderNumber: regex }, { customerName: regex }, { customerEmail: regex }, { customerPhone: regex }] })
      .select('orderNumber customerName total orderStatus createdAt')
      .limit(5)
      .lean(),
    UserModel.find({ role: 'customer', $or: [{ name: regex }, { email: regex }, { phone: regex }] })
      .select('name email phone status')
      .limit(5)
      .lean(),
  ]);

  return {
    products: products.map((p) => ({ id: String(p._id), name: p.name, sku: p.sku, status: p.status, price: p.salePrice ?? p.basePrice, imageUrl: p.images?.[0]?.url || '' })),
    orders: orders.map((o) => ({ id: String(o._id), orderNumber: o.orderNumber, customerName: o.customerName, total: o.total, status: o.orderStatus })),
    customers: customers.map((c) => ({ id: String(c._id), name: c.name, email: c.email, phone: c.phone || '', status: c.status })),
  };
}

export async function getAdminNotificationsFeed() {
  const [pendingOrders, lowStockProducts, pendingReviews, openEnquiries] = await Promise.all([
    OrderModel.find({ orderStatus: 'pending' }).sort({ createdAt: -1 }).limit(5).select('orderNumber customerName total createdAt').lean(),
    ProductModel.find({
      status: 'published',
      $expr: { $lte: [{ $subtract: ['$stockOnHand', '$reservedStock'] }, '$lowStockThreshold'] },
    })
      .select('name sku stockOnHand reservedStock')
      .limit(5)
      .lean(),
    ReviewModel.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(5).select('userName rating title createdAt').lean(),
    SupportEnquiryModel.find({ status: 'open' }).sort({ createdAt: -1 }).limit(5).select('name subject createdAt').lean(),
  ]);

  const items = [
    ...pendingOrders.map((o) => ({
      id: `ord-${String(o._id)}`,
      type: 'order',
      title: `New Pending Order #${o.orderNumber}`,
      subtitle: `${o.customerName} · ৳${o.total.toLocaleString()}`,
      link: `/admin/orders/${String(o._id)}`,
      createdAt: o.createdAt,
    })),
    ...lowStockProducts.map((p) => ({
      id: `stk-${String(p._id)}`,
      type: 'stock',
      title: `Low Stock: ${p.name}`,
      subtitle: `SKU ${p.sku} · ${Math.max(0, p.stockOnHand - p.reservedStock)} available`,
      link: '/admin/inventory',
      createdAt: new Date(),
    })),
    ...pendingReviews.map((r) => ({
      id: `rev-${String(r._id)}`,
      type: 'review',
      title: `Pending Review (${r.rating}/5)`,
      subtitle: `${r.userName} · ${r.title || 'Customer feedback'}`,
      link: `/admin/reviews/${String(r._id)}`,
      createdAt: r.createdAt,
    })),
    ...openEnquiries.map((e) => ({
      id: `sup-${String(e._id)}`,
      type: 'support',
      title: `Open Enquiry: ${e.subject}`,
      subtitle: `From ${e.name}`,
      link: '/admin/support',
      createdAt: e.createdAt,
    })),
  ];

  return { unreadCount: items.length, items: items.slice(0, 12) };
}

export async function getAnalyticsReport(days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [ordersByPayment, ordersByDivision, topProducts, topCustomers, inventorySummary, dailyRevenue] = await Promise.all([
    OrderModel.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$total' } } }]),
    OrderModel.aggregate([{ $match: { createdAt: { $gte: since }, orderStatus: { $ne: 'cancelled' } } }, { $group: { _id: '$shippingAddress.division', count: { $sum: 1 }, total: { $sum: '$total' } } }, { $sort: { total: -1 } }]),
    ProductModel.find({ status: { $ne: 'archived' } }).sort({ soldCount: -1 }).limit(15).select('name sku basePrice salePrice soldCount stockOnHand reservedStock ratingAverage').lean(),
    OrderModel.aggregate([
      { $match: { orderStatus: { $ne: 'cancelled' } } },
      { $group: { _id: '$userId', customerName: { $first: '$customerName' }, customerEmail: { $first: '$customerEmail' }, orderCount: { $sum: 1 }, totalSpent: { $sum: '$total' }, lastOrderAt: { $max: '$createdAt' } } },
      { $sort: { totalSpent: -1 } },
      { $limit: 15 },
    ]),
    ProductModel.aggregate([{ $match: { status: { $ne: 'archived' } } }, { $group: { _id: '$status', count: { $sum: 1 }, totalUnits: { $sum: '$stockOnHand' }, stockValue: { $sum: { $multiply: ['$stockOnHand', '$basePrice'] } } } }]),
    OrderModel.aggregate([
      { $match: { createdAt: { $gte: since }, orderStatus: { $nin: ['cancelled', 'returned'] } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, orders: { $sum: 1 }, revenue: { $sum: '$total' }, discount: { $sum: '$discount' } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return {
    days,
    ordersByPayment,
    ordersByDivision,
    topProducts: topProducts.map((p) => ({
      id: String(p._id),
      name: p.name,
      sku: p.sku,
      soldCount: p.soldCount,
      availableStock: Math.max(0, p.stockOnHand - p.reservedStock),
      revenueEstimate: (p.salePrice ?? p.basePrice) * (p.soldCount || 0),
      ratingAverage: p.ratingAverage,
    })),
    topCustomers,
    inventorySummary,
    dailyRevenue,
  };
}

export async function exportSalesCsv() {
  const orders = await OrderModel.find().sort({ createdAt: -1 }).limit(1000).lean();
  const header = 'orderNumber,date,customerName,customerPhone,division,paymentMethod,paymentStatus,orderStatus,subtotal,discount,shippingCharge,total';
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = orders.map((o) =>
    [
      esc(o.orderNumber),
      esc(new Date(o.createdAt).toISOString()),
      esc(o.customerName),
      esc(o.customerPhone),
      esc(o.shippingAddress?.division || ''),
      esc(o.paymentMethod),
      esc(o.paymentStatus),
      esc(o.orderStatus),
      o.subtotal,
      o.discount,
      o.shippingCharge,
      o.total,
    ].join(','),
  );
  return [header, ...rows].join('\n');
}
