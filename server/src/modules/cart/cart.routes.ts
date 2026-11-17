import { Router, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { CartModel, WishlistModel } from './cart.model';
import { ProductModel } from '../products/product.model';
import { CouponModel, CouponRedemptionModel, DiscountRuleModel } from '../coupons/coupon.model';
import { AddressModel } from '../addresses/address.model';
import { requireDatabase } from '../../database/connection';
import { authenticateRequired, type AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import {
  evaluateCouponDiscount,
  evaluateDiscountRules,
  mergeCartLines,
  resolveEffectiveUnitPrice,
} from '../../../../src/lib/pricingEngine';
import { computeAvailableStock } from '../../../../src/lib/orderStateMachine';
import { validateBangladeshAddressHierarchy } from '../../../../src/lib/bdLocations';

const router = Router();

async function hydrateCart(userId: unknown) {
  let cart = await CartModel.findOne({ userId });
  if (!cart) {
    cart = await CartModel.create({ userId, items: [], couponCode: null });
  }

  const productIds = cart.items.map((i: { productId: unknown }) => i.productId);
  const products = await ProductModel.find({ _id: { $in: productIds } }).lean();
  const prodMap = new Map(products.map((p) => [String(p._id), p]));

  const hydratedItems = [];
  for (const line of cart.items) {
    const prod = prodMap.get(String(line.productId));
    if (!prod || prod.status !== 'published') continue;

    const variant = line.variantId
      ? prod.variants.find((v: { _id: unknown; isActive?: boolean }) => String(v._id) === String(line.variantId) && v.isActive !== false)
      : null;

    const availableStock = variant
      ? computeAvailableStock(variant.stockOnHand, variant.reservedStock)
      : computeAvailableStock(prod.stockOnHand, prod.reservedStock);

    const pricing = resolveEffectiveUnitPrice({
      basePrice: variant?.price ?? prod.basePrice,
      salePrice: variant?.salePrice ?? prod.salePrice,
      flashSalePrice: prod.flashSalePrice,
      flashSaleStartsAt: prod.flashSaleStartsAt,
      flashSaleEndsAt: prod.flashSaleEndsAt,
    });

    hydratedItems.push({
      productId: String(prod._id),
      variantId: variant ? String(variant._id) : null,
      slug: prod.slug,
      name: prod.name,
      sku: variant?.sku || prod.sku,
      variantTitle: variant?.title || null,
      imageUrl: variant?.imageUrl || prod.images?.[0]?.url || '',
      unitPrice: pricing.currentPrice,
      originalPrice: pricing.originalPrice,
      quantity: Math.min(line.quantity, Math.max(1, availableStock || 1)),
      availableStock,
      isAvailable: availableStock >= line.quantity && availableStock > 0,
      categoryId: String(prod.categoryId),
    });
  }

  const subtotal = hydratedItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  let discount = 0;
  let couponMessage: string | null = null;
  let activeCouponCode = cart.couponCode || null;
  let appliedRuleName: string | null = null;

  if (activeCouponCode) {
    const coupon = await CouponModel.findOne({ code: activeCouponCode.toUpperCase() }).lean();
    if (!coupon) {
      activeCouponCode = null;
      cart.couponCode = null;
      await cart.save();
    } else {
      const customerUsedCount = await CouponRedemptionModel.countDocuments({
        couponId: coupon._id,
        userId,
      });
      const evalRes = evaluateCouponDiscount(
        {
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          maxDiscountAmount: coupon.maxDiscountAmount,
          minOrderAmount: coupon.minOrderAmount,
          startsAt: coupon.startsAt,
          endsAt: coupon.endsAt,
          isActive: coupon.isActive,
          usageLimit: coupon.usageLimit,
          usedCount: coupon.usedCount,
          perCustomerLimit: coupon.perCustomerLimit,
          customerUsedCount,
          eligibleCategoryIds: coupon.eligibleCategoryIds?.map(String),
          eligibleProductIds: coupon.eligibleProductIds?.map(String),
        },
        hydratedItems,
      );
      if (evalRes.valid) {
        discount = evalRes.discountAmount;
      } else {
        couponMessage = evalRes.reason || 'Coupon is not eligible.';
        activeCouponCode = null;
      }
    }
  }

  if (!activeCouponCode && hydratedItems.length > 0) {
    const activeRules = await DiscountRuleModel.find({ isActive: true }).lean();
    if (activeRules.length > 0) {
      const ruleEval = evaluateDiscountRules(
        activeRules.map((r) => ({
          id: String(r._id),
          name: r.name,
          ruleType: r.ruleType,
          value: r.value,
          minQty: r.minQty,
          minSpend: r.minSpend,
          isActive: r.isActive,
          startsAt: r.startsAt,
          endsAt: r.endsAt,
        })),
        hydratedItems,
      );
      if (ruleEval.discountAmount > 0) {
        discount = ruleEval.discountAmount;
        appliedRuleName = ruleEval.appliedRuleName;
      }
    }
  }

  return {
    items: hydratedItems,
    couponCode: activeCouponCode,
    appliedRuleName,
    couponMessage,
    subtotal,
    discount,
  };
}

// Cart routes (authenticated persistence)
router.get('/cart', requireDatabase, authenticateRequired, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = await hydrateCart(req.user!._id);
    res.json({ ok: true, cart: data });
  } catch (err) {
    next(err);
  }
});

router.post('/cart/items', requireDatabase, authenticateRequired, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      productId: z.string().min(1),
      variantId: z.string().nullable().optional(),
      quantity: z.number().int().min(1).max(99),
    });
    const parsed = schema.parse(req.body);

    const product = await ProductModel.findOne({ _id: parsed.productId, status: 'published' });
    if (!product) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product is unavailable.');
    }

    let availableStock = computeAvailableStock(product.stockOnHand, product.reservedStock);
    if (product.hasVariants && product.variants.length > 0) {
      if (!parsed.variantId) {
        throw new AppError(400, 'VARIANT_REQUIRED', 'Please select a product variant.');
      }
      const variant = product.variants.find((v: { _id: unknown; isActive?: boolean }) => String(v._id) === parsed.variantId && v.isActive !== false);
      if (!variant) {
        throw new AppError(404, 'VARIANT_NOT_FOUND', 'Selected product variant is unavailable.');
      }
      availableStock = computeAvailableStock(variant.stockOnHand, variant.reservedStock);
    }

    if (availableStock <= 0) {
      throw new AppError(409, 'OUT_OF_STOCK', 'This product is currently out of stock.');
    }

    let cart = await CartModel.findOne({ userId: req.user!._id });
    if (!cart) {
      cart = await CartModel.create({ userId: req.user!._id, items: [] });
    }

    const merged = mergeCartLines(
      cart.items.map((i: { productId: unknown; variantId?: string | null; quantity: number }) => ({
        productId: String(i.productId),
        variantId: i.variantId || null,
        quantity: i.quantity,
      })),
      [
        {
          productId: parsed.productId,
          variantId: parsed.variantId || null,
          quantity: parsed.quantity,
          maxStock: availableStock,
        },
      ],
    );

    cart.items = merged.map((m) => ({
      productId: m.productId as unknown as typeof cart.items[0]['productId'],
      variantId: m.variantId || null,
      quantity: m.quantity,
    }));
    await cart.save();

    const data = await hydrateCart(req.user!._id);
    res.json({ ok: true, cart: data });
  } catch (err) {
    next(err);
  }
});

router.patch('/cart/items', requireDatabase, authenticateRequired, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      productId: z.string().min(1),
      variantId: z.string().nullable().optional(),
      quantity: z.number().int().min(0).max(99),
    });
    const parsed = schema.parse(req.body);

    const cart = await CartModel.findOne({ userId: req.user!._id });
    if (!cart) {
      res.json({ ok: true, cart: await hydrateCart(req.user!._id) });
      return;
    }

    const variantKey = parsed.variantId ? String(parsed.variantId) : null;
    if (parsed.quantity <= 0) {
      cart.items = cart.items.filter(
        (i: { productId: unknown; variantId?: string | null }) =>
          !(String(i.productId) === parsed.productId && (i.variantId || null) === variantKey),
      );
    } else {
      const product = await ProductModel.findById(parsed.productId);
      if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
      const variant = variantKey ? product.variants.find((v: { _id: unknown }) => String(v._id) === variantKey) : null;
      const available = variant
        ? computeAvailableStock(variant.stockOnHand, variant.reservedStock)
        : computeAvailableStock(product.stockOnHand, product.reservedStock);

      if (parsed.quantity > available) {
        throw new AppError(409, 'INSUFFICIENT_STOCK', `Only ${available} units available in stock.`);
      }

      const target = cart.items.find(
        (i: { productId: unknown; variantId?: string | null; quantity: number }) =>
          String(i.productId) === parsed.productId && (i.variantId || null) === variantKey,
      );
      if (target) target.quantity = parsed.quantity;
    }

    await cart.save();
    res.json({ ok: true, cart: await hydrateCart(req.user!._id) });
  } catch (err) {
    next(err);
  }
});

router.post('/cart/merge', requireDatabase, authenticateRequired, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      items: z.array(
        z.object({
          productId: z.string().min(1),
          variantId: z.string().nullable().optional(),
          quantity: z.number().int().min(1).max(99),
        }),
      ),
    });
    const parsed = schema.parse(req.body);

    let cart = await CartModel.findOne({ userId: req.user!._id });
    if (!cart) {
      cart = await CartModel.create({ userId: req.user!._id, items: [] });
    }

    // Verify products exist and clamp against real stock
    const incomingValidated = [];
    for (const item of parsed.items) {
      const prod = await ProductModel.findOne({ _id: item.productId, status: 'published' });
      if (!prod) continue;
      const variant = item.variantId ? prod.variants.find((v: { _id: unknown }) => String(v._id) === item.variantId) : null;
      const available = variant
        ? computeAvailableStock(variant.stockOnHand, variant.reservedStock)
        : computeAvailableStock(prod.stockOnHand, prod.reservedStock);
      if (available > 0) {
        incomingValidated.push({
          productId: String(prod._id),
          variantId: variant ? String(variant._id) : null,
          quantity: item.quantity,
          maxStock: available,
        });
      }
    }

    const merged = mergeCartLines(
      cart.items.map((i: { productId: unknown; variantId?: string | null; quantity: number }) => ({
        productId: String(i.productId),
        variantId: i.variantId || null,
        quantity: i.quantity,
      })),
      incomingValidated,
    );

    cart.items = merged.map((m) => ({
      productId: m.productId as unknown as typeof cart.items[0]['productId'],
      variantId: m.variantId || null,
      quantity: m.quantity,
    }));
    await cart.save();

    res.json({ ok: true, cart: await hydrateCart(req.user!._id) });
  } catch (err) {
    next(err);
  }
});

router.post('/cart/coupon', requireDatabase, authenticateRequired, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { code } = z.object({ code: z.string().trim().max(40) }).parse(req.body);
    const cart = await CartModel.findOne({ userId: req.user!._id });
    if (!cart) throw new AppError(404, 'CART_NOT_FOUND', 'Cart not found.');

    if (!code) {
      cart.couponCode = null;
      await cart.save();
      res.json({ ok: true, cart: await hydrateCart(req.user!._id) });
      return;
    }

    const coupon = await CouponModel.findOne({ code: code.toUpperCase() }).lean();
    if (!coupon) {
      throw new AppError(404, 'INVALID_COUPON', 'Coupon code not found.');
    }

    cart.couponCode = coupon.code;
    await cart.save();
    const data = await hydrateCart(req.user!._id);
    if (data.couponMessage) {
      cart.couponCode = null;
      await cart.save();
      throw new AppError(400, 'COUPON_INELIGIBLE', data.couponMessage);
    }

    res.json({ ok: true, cart: data });
  } catch (err) {
    next(err);
  }
});

// Wishlist routes
router.get('/wishlist', requireDatabase, authenticateRequired, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const wl = await WishlistModel.findOne({ userId: req.user!._id }).populate('productIds').lean();
    const products = (wl?.productIds || []).map((p: Record<string, unknown>) => {
      const pricing = resolveEffectiveUnitPrice({
        basePrice: Number(p.basePrice || 0),
        salePrice: p.salePrice != null ? Number(p.salePrice) : null,
        flashSalePrice: p.flashSalePrice != null ? Number(p.flashSalePrice) : null,
        flashSaleStartsAt: p.flashSaleStartsAt ? String(p.flashSaleStartsAt) : null,
        flashSaleEndsAt: p.flashSaleEndsAt ? String(p.flashSaleEndsAt) : null,
      });
      return {
        id: String(p._id),
        name: p.name,
        slug: p.slug,
        brandName: p.brandName,
        images: p.images,
        currentPrice: pricing.currentPrice,
        originalPrice: pricing.originalPrice,
        discountPercent: pricing.discountPercent,
        stockOnHand: p.stockOnHand,
        reservedStock: p.reservedStock,
      };
    });
    res.json({ ok: true, products });
  } catch (err) {
    next(err);
  }
});

router.post('/wishlist/toggle', requireDatabase, authenticateRequired, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { productId } = z.object({ productId: z.string().min(1) }).parse(req.body);
    let wl = await WishlistModel.findOne({ userId: req.user!._id });
    if (!wl) {
      wl = await WishlistModel.create({ userId: req.user!._id, productIds: [] });
    }
    const exists = wl.productIds.some((id: unknown) => String(id) === productId);
    if (exists) {
      wl.productIds = wl.productIds.filter((id: unknown) => String(id) !== productId);
    } else {
      wl.productIds.push(productId as unknown as typeof wl.productIds[0]);
    }
    await wl.save();
    res.json({ ok: true, wishlisted: !exists, productIds: wl.productIds.map(String) });
  } catch (err) {
    next(err);
  }
});

// Address CRUD routes with Bangladesh hierarchy validation
const addressSchema = z.object({
  label: z.string().trim().min(1).max(40).default('Home'),
  recipientName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(10).max(24),
  division: z.string().trim().min(2),
  district: z.string().trim().min(2),
  upazila: z.string().trim().min(2),
  area: z.string().trim().min(2),
  house: z.string().trim().min(2).max(140),
  road: z.string().trim().max(140).optional(),
  landmark: z.string().trim().max(140).optional(),
  postalCode: z.string().trim().max(12).optional(),
  deliveryInstructions: z.string().trim().max(240).optional(),
  isDefault: z.boolean().optional(),
});

router.get('/addresses', requireDatabase, authenticateRequired, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const addresses = await AddressModel.find({ userId: req.user!._id }).sort({ isDefault: -1, createdAt: -1 }).lean();
    res.json({ ok: true, addresses: addresses.map((a) => ({ ...a, id: String(a._id) })) });
  } catch (err) {
    next(err);
  }
});

router.post('/addresses', requireDatabase, authenticateRequired, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = addressSchema.parse(req.body);
    const hierarchyCheck = validateBangladeshAddressHierarchy({
      division: parsed.division,
      district: parsed.district,
      upazila: parsed.upazila,
      area: parsed.area,
    });
    if (!hierarchyCheck.valid) {
      throw new AppError(400, 'INVALID_BD_ADDRESS', hierarchyCheck.reason || 'Invalid Bangladesh address hierarchy.');
    }

    const count = await AddressModel.countDocuments({ userId: req.user!._id });
    const shouldBeDefault = Boolean(parsed.isDefault) || count === 0;
    if (shouldBeDefault) {
      await AddressModel.updateMany({ userId: req.user!._id }, { $set: { isDefault: false } });
    }

    const address = await AddressModel.create({
      ...parsed,
      userId: req.user!._id,
      isDefault: shouldBeDefault,
    });
    res.status(201).json({ ok: true, address: { ...address.toObject(), id: String(address._id) } });
  } catch (err) {
    next(err);
  }
});

router.patch('/addresses/:id', requireDatabase, authenticateRequired, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = addressSchema.parse(req.body);
    const hierarchyCheck = validateBangladeshAddressHierarchy({
      division: parsed.division,
      district: parsed.district,
      upazila: parsed.upazila,
      area: parsed.area,
    });
    if (!hierarchyCheck.valid) {
      throw new AppError(400, 'INVALID_BD_ADDRESS', hierarchyCheck.reason || 'Invalid Bangladesh address hierarchy.');
    }

    if (parsed.isDefault) {
      await AddressModel.updateMany({ userId: req.user!._id }, { $set: { isDefault: false } });
    }

    const updated = await AddressModel.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!._id },
      { $set: parsed },
      { new: true },
    );
    if (!updated) throw new AppError(404, 'ADDRESS_NOT_FOUND', 'Address not found.');
    res.json({ ok: true, address: { ...updated.toObject(), id: String(updated._id) } });
  } catch (err) {
    next(err);
  }
});

router.delete('/addresses/:id', requireDatabase, authenticateRequired, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const deleted = await AddressModel.findOneAndDelete({ _id: req.params.id, userId: req.user!._id });
    if (!deleted) throw new AppError(404, 'ADDRESS_NOT_FOUND', 'Address not found.');
    if (deleted.isDefault) {
      const nextDefault = await AddressModel.findOne({ userId: req.user!._id }).sort({ createdAt: -1 });
      if (nextDefault) {
        nextDefault.isDefault = true;
        await nextDefault.save();
      }
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
