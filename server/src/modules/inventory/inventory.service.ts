import { ProductModel } from '../products/product.model';
import { InventoryMovementModel } from './inventoryMovement.model';
import { AppError } from '../../middleware/error.middleware';

export async function listStockLevels(params: { q?: string; stockFilter?: string; page: number; limit: number }) {
  const { q, stockFilter, page, limit } = params;
  const filter: Record<string, unknown> = { status: { $ne: 'archived' } };
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: regex }, { sku: regex }, { brandName: regex }];
  }
  if (stockFilter === 'out') {
    filter.$expr = { $lte: [{ $subtract: ['$stockOnHand', '$reservedStock'] }, 0] };
  } else if (stockFilter === 'low') {
    filter.$expr = { $lte: [{ $subtract: ['$stockOnHand', '$reservedStock'] }, '$lowStockThreshold'] };
  }

  const [total, products] = await Promise.all([
    ProductModel.countDocuments(filter),
    ProductModel.find(filter)
      .populate('categoryId', 'name slug')
      .select('name sku stockOnHand reservedStock lowStockThreshold status hasVariants variants images basePrice salePrice categoryId')
      .sort({ stockOnHand: 1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return {
    items: products.map((p) => {
      const available = p.hasVariants && p.variants?.length
        ? p.variants.reduce((sum: number, v: { stockOnHand: number; reservedStock: number }) => sum + Math.max(0, v.stockOnHand - v.reservedStock), 0)
        : Math.max(0, p.stockOnHand - p.reservedStock);
      return { ...p, id: String(p._id), availableStock: available };
    }),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function listInventoryMovements(limit = 50, productId?: string) {
  const filter: Record<string, unknown> = {};
  if (productId) filter.productId = productId;
  const movements = await InventoryMovementModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  return movements.map((m) => ({ ...m, id: String(m._id) }));
}

export async function adjustInventoryStock(params: {
  productId: string;
  variantId?: string | null;
  delta: number;
  reason: string;
  actorId: unknown;
  actorName: string;
}) {
  const product = await ProductModel.findById(params.productId);
  if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');

  if (params.variantId) {
    const variant = product.variants.find((v: { _id: unknown }) => String(v._id) === params.variantId);
    if (!variant) throw new AppError(404, 'VARIANT_NOT_FOUND', 'Variant not found.');
    const prev = variant.stockOnHand;
    const nextVal = prev + params.delta;
    if (nextVal < variant.reservedStock) {
      throw new AppError(409, 'INVALID_STOCK_LEVEL', `Stock cannot drop below reserved quantity (${variant.reservedStock}).`);
    }
    variant.stockOnHand = nextVal;
    await product.save();

    await InventoryMovementModel.create({
      productId: product._id,
      variantId: variant._id,
      sku: variant.sku,
      productName: `${product.name} (${variant.title})`,
      type: 'adjustment',
      delta: params.delta,
      previousStockOnHand: prev,
      newStockOnHand: nextVal,
      previousReserved: variant.reservedStock,
      newReserved: variant.reservedStock,
      reason: params.reason,
      actorId: params.actorId,
      actorName: params.actorName,
    });
  } else {
    const prev = product.stockOnHand;
    const nextVal = prev + params.delta;
    if (nextVal < product.reservedStock) {
      throw new AppError(409, 'INVALID_STOCK_LEVEL', `Stock cannot drop below reserved quantity (${product.reservedStock}).`);
    }
    product.stockOnHand = nextVal;
    await product.save();

    await InventoryMovementModel.create({
      productId: product._id,
      sku: product.sku,
      productName: product.name,
      type: 'adjustment',
      delta: params.delta,
      previousStockOnHand: prev,
      newStockOnHand: nextVal,
      previousReserved: product.reservedStock,
      newReserved: product.reservedStock,
      reason: params.reason,
      actorId: params.actorId,
      actorName: params.actorName,
    });
  }

  return { ...product.toObject(), id: String(product._id) };
}
