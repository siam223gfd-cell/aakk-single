import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { ProductModel } from './product.model';
import { CategoryModel, BrandModel } from '../categories/category.model';
import { ReviewModel } from '../reviews/review.model';
import { OrderModel } from '../orders/order.model';
import { SearchAnalyticsModel } from '../support/support.model';
import { requireDatabase } from '../../database/connection';
import { authenticateOptional, authenticateRequired, type AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { resolveEffectiveUnitPrice } from '../../../../src/lib/pricingEngine';
import {
  buildEffectivePriceMongoExpr,
  buildProductCatalogFilter,
  buildSearchFilter,
  collectDescendantCategoryIds,
  enrichProductPricing,
  getCatalogSortSpec,
} from './productCatalogHelpers';

const router = Router();

// Bounded autocomplete suggestions (max 8)
router.get('/search/suggestions', requireDatabase, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q || '').trim();
    const rawLimit = Number(req.query.limit || 8);
    const limit = Math.min(8, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 8));

    if (q.length < 1) {
      res.json({ ok: true, suggestions: [] });
      return;
    }

    const searchFilter = buildSearchFilter(q);
    const items = await ProductModel.find({ status: 'published', ...searchFilter })
      .select('name nameBn slug sku basePrice salePrice flashSalePrice flashSaleStartsAt flashSaleEndsAt images brandName')
      .sort({ soldCount: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    const suggestions = items.map((item) => {
      const pricing = resolveEffectiveUnitPrice({
        basePrice: item.basePrice,
        salePrice: item.salePrice,
        flashSalePrice: item.flashSalePrice,
        flashSaleStartsAt: item.flashSaleStartsAt,
        flashSaleEndsAt: item.flashSaleEndsAt,
      });
      return {
        id: String(item._id),
        name: item.name,
        slug: item.slug,
        brandName: item.brandName || '',
        imageUrl: item.images?.[0]?.url || '',
        currentPrice: pricing.currentPrice,
        originalPrice: pricing.originalPrice,
        discountPercent: pricing.discountPercent,
      };
    });

    res.json({ ok: true, suggestions });
  } catch (err) {
    next(err);
  }
});

// Product listing with server-side filters, pagination, and sorting
router.get('/', requireDatabase, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(48, Math.max(1, Number(req.query.limit || 16)));
    const q = String(req.query.q || '').trim();
    const categorySlug = String(req.query.category || '').trim().toLowerCase();
    const subCategorySlug = String(req.query.subCategory || '').trim().toLowerCase();
    const brandSlug = String(req.query.brand || '').trim().toLowerCase();
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;
    const inStockOnly = req.query.inStock === 'true';
    const discountOnly = req.query.discount === 'true';
    const minRating = req.query.minRating ? Number(req.query.minRating) : null;
    const section = String(req.query.section || '').trim().toLowerCase();
    const sort = String(req.query.sort || 'popular');

    const allCategories = await CategoryModel.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();

    let resolvedCategory: Record<string, unknown> | null = null;
    let categoryIds: unknown[] | undefined;
    let subcategories: Array<Record<string, unknown>> = [];

    if (categorySlug && categorySlug !== 'all') {
      const matched = allCategories.find((c) => c.slug === categorySlug);
      if (matched) {
        resolvedCategory = {
          ...matched,
          id: String(matched._id),
          parentId: matched.parentId ? String(matched.parentId) : null,
        };
        categoryIds = collectDescendantCategoryIds(matched._id, allCategories);
        subcategories = allCategories
          .filter((c) => c.parentId && String(c.parentId) === String(matched._id))
          .map((c) => ({ ...c, id: String(c._id), parentId: String(c.parentId) }));
      }
    }

    let subCategoryIds: unknown[] | undefined;
    if (subCategorySlug && subCategorySlug !== 'all') {
      const matchedSub = allCategories.find((c) => c.slug === subCategorySlug);
      if (matchedSub) {
        subCategoryIds = collectDescendantCategoryIds(matchedSub._id, allCategories);
      }
    }

    let brandId: unknown;
    if (brandSlug) {
      const brand = await BrandModel.findOne({ slug: brandSlug, isActive: true }).lean();
      if (brand) brandId = brand._id;
    }

    const filter = buildProductCatalogFilter({
      q,
      categoryIds,
      categorySlugFallback: !resolvedCategory && categorySlug && categorySlug !== 'all' ? categorySlug : undefined,
      subCategoryIds,
      subCategorySlugFallback: !subCategoryIds && subCategorySlug && subCategorySlug !== 'all' ? subCategorySlug : undefined,
      brandId,
      brandSlug: !brandId && brandSlug ? brandSlug : undefined,
      minPrice,
      maxPrice,
      inStockOnly,
      discountOnly,
      minRating,
      section,
      now,
    });

    const sortSpec = getCatalogSortSpec(sort, section);
    const needsEffectivePriceSort = sort === 'price_asc' || sort === 'price_desc';

    let total = 0;
    let rawProducts: Array<Record<string, unknown>> = [];

    if (needsEffectivePriceSort) {
      const effectivePriceExpr = buildEffectivePriceMongoExpr(now);
      const [aggResult] = await ProductModel.aggregate([
        { $match: filter },
        { $addFields: { _effectivePrice: effectivePriceExpr } },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            items: [
              { $sort: sortSpec },
              { $skip: (page - 1) * limit },
              { $limit: limit },
            ],
          },
        },
      ]);

      total = aggResult?.metadata?.[0]?.total ?? 0;
      const items = (aggResult?.items || []) as Array<Record<string, unknown>>;
      const populated = await ProductModel.populate(items, {
        path: 'categoryId',
        select: 'name slug attributeSchemaType',
      });
      rawProducts = populated as unknown as Array<Record<string, unknown>>;
    } else {
      const [count, found] = await Promise.all([
        ProductModel.countDocuments(filter),
        ProductModel.find(filter)
          .populate('categoryId', 'name slug attributeSchemaType')
          .sort(sortSpec)
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
      ]);
      total = count;
      rawProducts = found as unknown as Array<Record<string, unknown>>;
    }

    if (q) {
      await SearchAnalyticsModel.create({
        query: q,
        normalizedQuery: q.toLowerCase(),
        resultCount: total,
      }).catch(() => undefined);
    }

    res.json({
      ok: true,
      products: rawProducts.map((p) => enrichProductPricing(p, now)),
      category: resolvedCategory,
      subcategories,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Product detail by slug
router.get('/:slug', requireDatabase, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = String(req.params.slug || '').toLowerCase();
    const product = await ProductModel.findOne({ slug, status: 'published' })
      .populate('categoryId', 'name nameBn slug attributeSchemaType')
      .populate('brandId', 'name slug logoUrl')
      .lean();

    if (!product) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found or currently unavailable.');
    }

    const categoryRef = product.categoryId?._id || product.categoryId;
    const sameCategoryRelated = await ProductModel.find({
      _id: { $ne: product._id },
      $or: [
        { categoryId: categoryRef },
        ...(product.subCategoryId ? [{ subCategoryId: product.subCategoryId }] : []),
      ],
      status: 'published',
    })
      .populate('categoryId', 'name slug')
      .sort({ soldCount: -1, createdAt: -1 })
      .limit(4)
      .lean();

    let relatedRaw = sameCategoryRelated;
    if (relatedRaw.length < 4) {
      const excludeIds = [product._id, ...relatedRaw.map((r) => r._id)];
      const fallbackRelated = await ProductModel.find({
        _id: { $nin: excludeIds },
        status: 'published',
      })
        .populate('categoryId', 'name slug')
        .sort({ isFeatured: -1, soldCount: -1, createdAt: -1 })
        .limit(4 - relatedRaw.length)
        .lean();
      relatedRaw = [...relatedRaw, ...fallbackRelated];
    }

    res.json({
      ok: true,
      product: enrichProductPricing(product as unknown as Record<string, unknown>),
      relatedProducts: relatedRaw.map((p) => enrichProductPricing(p as unknown as Record<string, unknown>)),
    });
  } catch (err) {
    next(err);
  }
});

// Public approved reviews + rating distribution for a product
router.get('/:slug/reviews', requireDatabase, authenticateOptional, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const product = await ProductModel.findOne({ slug: String(req.params.slug).toLowerCase() }).select('_id ratingAverage reviewCount').lean();
    if (!product) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
    }

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(20, Math.max(1, Number(req.query.limit || 8)));
    const sort = String(req.query.sort || 'newest');

    let sortObj: Record<string, 1 | -1> = { createdAt: -1 };
    if (sort === 'highest') sortObj = { rating: -1, createdAt: -1 };
    if (sort === 'lowest') sortObj = { rating: 1, createdAt: -1 };

    const [reviews, total, distribution] = await Promise.all([
      ReviewModel.find({ productId: product._id, status: 'approved' })
        .sort(sortObj)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ReviewModel.countDocuments({ productId: product._id, status: 'approved' }),
      ReviewModel.aggregate([
        { $match: { productId: product._id, status: 'approved' } },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
      ]),
    ]);

    const histogram: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const row of distribution) {
      histogram[Number(row._id)] = Number(row.count);
    }

    let canReview = false;
    let hasPurchased = false;
    if (req.user) {
      const [existingReview, deliveredOrder] = await Promise.all([
        ReviewModel.findOne({ productId: product._id, userId: req.user._id }).select('_id').lean(),
        OrderModel.findOne({
          userId: req.user._id,
          orderStatus: 'delivered',
          'items.productId': product._id,
        })
          .select('_id')
          .lean(),
      ]);
      hasPurchased = Boolean(deliveredOrder);
      canReview = !existingReview && hasPurchased;
    }

    res.json({
      ok: true,
      reviews,
      summary: {
        average: product.ratingAverage || 0,
        total,
        histogram,
      },
      eligibility: {
        canReview,
        hasPurchased,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Submit a review (requires authenticated customer with a delivered order for this product)
router.post('/:slug/reviews', requireDatabase, authenticateRequired, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      rating: z.number().int().min(1).max(5),
      title: z.string().trim().min(3).max(120),
      comment: z.string().trim().min(10).max(1500),
    });
    const parsed = schema.parse(req.body);

    const product = await ProductModel.findOne({ slug: String(req.params.slug).toLowerCase(), status: 'published' });
    if (!product) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
    }

    const deliveredOrder = await OrderModel.findOne({
      userId: req.user!._id,
      orderStatus: 'delivered',
      'items.productId': product._id,
    }).sort({ createdAt: -1 });

    if (!deliveredOrder) {
      throw new AppError(
        403,
        'REVIEW_NOT_ELIGIBLE',
        'Only customers who have received a delivered order for this product may submit a review.',
      );
    }

    const existing = await ReviewModel.findOne({ productId: product._id, userId: req.user!._id });
    if (existing) {
      throw new AppError(409, 'DUPLICATE_REVIEW', 'You have already submitted a review for this product.');
    }

    const review = await ReviewModel.create({
      productId: product._id,
      userId: req.user!._id,
      userName: req.user!.name,
      orderId: deliveredOrder._id,
      rating: parsed.rating,
      title: parsed.title,
      comment: parsed.comment,
      isVerifiedPurchase: true,
      status: 'pending', // Requires admin moderation before appearing in public rating aggregates
    });

    res.status(201).json({
      ok: true,
      review,
      message: 'Review submitted and pending moderation approval.',
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:slug/reviews/:reviewId/report', requireDatabase, authenticateRequired, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await ReviewModel.updateOne(
      { _id: req.params.reviewId },
      { $addToSet: { reportedBy: req.user!._id } },
    );
    res.json({ ok: true, message: 'Review has been flagged for moderator review.' });
  } catch (err) {
    next(err);
  }
});

export default router;
