import { ProductModel } from './product.model';
import { CategoryModel, BrandModel } from '../categories/category.model';
import { ProductAttributePresetModel } from '../cms/cms.model';
import { InventoryMovementModel } from '../inventory/inventoryMovement.model';
import { OrderModel } from '../orders/order.model';
import { AppError } from '../../middleware/error.middleware';
import { buildCategoryAncestryPath, enrichProductPricing } from './productCatalogHelpers';
import type { z } from 'zod';
import type { attributePresetSchema, bulkActionSchema, bulkImportSchema, productSchema } from './product.validation';

export async function listProductsAdmin(params: {
  page: number;
  limit: number;
  q: string;
  status: string;
  categoryId: string;
}) {
  const { page, limit, q, status, categoryId } = params;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (categoryId) {
    filter.$or = [{ categoryId }, { subCategoryId: categoryId }];
  }
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const searchCond = [{ name: regex }, { sku: regex }, { brandName: regex }, { slug: regex }];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or as unknown[] }, { $or: searchCond }];
      delete filter.$or;
    } else {
      filter.$or = searchCond;
    }
  }

  const [total, products] = await Promise.all([
    ProductModel.countDocuments(filter),
    ProductModel.find(filter)
      .populate('categoryId', 'name slug')
      .populate('subCategoryId', 'name slug')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return {
    products: products.map((p) => enrichProductPricing(p as unknown as Record<string, unknown>)),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function getProductByIdAdmin(id: string) {
  const product = await ProductModel.findById(id)
    .populate('categoryId', 'name slug')
    .populate('subCategoryId', 'name slug')
    .populate('brandId', 'name slug logoUrl')
    .lean();
  if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');

  const recentMovements = await InventoryMovementModel.find({ productId: product._id })
    .sort({ createdAt: -1 })
    .limit(15)
    .lean();

  return {
    product: enrichProductPricing(product as unknown as Record<string, unknown>),
    movements: recentMovements.map((m) => ({ ...m, id: String(m._id) })),
  };
}

export async function createProductAdmin(parsed: z.infer<typeof productSchema>) {
  const allCategories = await CategoryModel.find().lean();
  const category = allCategories.find((c) => String(c._id) === parsed.categoryId);
  if (!category) throw new AppError(400, 'INVALID_CATEGORY', 'Selected category does not exist.');

  if (parsed.subCategoryId) {
    const subCat = allCategories.find((c) => String(c._id) === parsed.subCategoryId);
    if (!subCat) throw new AppError(400, 'INVALID_SUBCATEGORY', 'Selected subcategory does not exist.');
  }

  let brandName = parsed.brandName || '';
  if (parsed.brandId) {
    const brand = await BrandModel.findById(parsed.brandId);
    if (brand) brandName = brand.name;
  }

  const categoryPath = buildCategoryAncestryPath({
    categoryId: String(category._id),
    subCategoryId: parsed.subCategoryId || null,
    allCategories,
  });

  const product = await ProductModel.create({
    ...parsed,
    brandId: parsed.brandId || null,
    subCategoryId: parsed.subCategoryId || null,
    brandName,
    categoryPath,
  });

  return enrichProductPricing(product.toObject({ flattenMaps: true }) as unknown as Record<string, unknown>);
}

export async function updateProductAdmin(id: string, parsed: z.infer<typeof productSchema>) {
  const existing = await ProductModel.findById(id);
  if (!existing) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');

  const allCategories = await CategoryModel.find().lean();
  const category = allCategories.find((c) => String(c._id) === parsed.categoryId);
  if (!category) throw new AppError(400, 'INVALID_CATEGORY', 'Selected category does not exist.');

  if (parsed.subCategoryId) {
    const subCat = allCategories.find((c) => String(c._id) === parsed.subCategoryId);
    if (!subCat) throw new AppError(400, 'INVALID_SUBCATEGORY', 'Selected subcategory does not exist.');
  }

  let brandName = parsed.brandName || '';
  if (parsed.brandId) {
    const brand = await BrandModel.findById(parsed.brandId);
    if (brand) brandName = brand.name;
  }

  const categoryPath = buildCategoryAncestryPath({
    categoryId: String(category._id),
    subCategoryId: parsed.subCategoryId || null,
    allCategories,
  });

  const priceChanged = existing.basePrice !== parsed.basePrice || existing.salePrice !== parsed.salePrice;

  Object.assign(existing, {
    ...parsed,
    brandId: parsed.brandId || null,
    subCategoryId: parsed.subCategoryId || null,
    brandName,
    categoryPath,
  });
  await existing.save();

  return {
    product: enrichProductPricing(existing.toObject({ flattenMaps: true }) as unknown as Record<string, unknown>),
    priceChanged,
    sku: existing.sku,
    name: existing.name,
    id: String(existing._id),
  };
}

export async function updateProductStatusAdmin(id: string, status: 'draft' | 'published' | 'archived') {
  const product = await ProductModel.findById(id);
  if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');

  const prevStatus = product.status;
  product.status = status;
  await product.save();

  return {
    product: enrichProductPricing(product.toObject({ flattenMaps: true }) as unknown as Record<string, unknown>),
    prevStatus,
    sku: product.sku,
    name: product.name,
    id: String(product._id),
  };
}

export async function deleteProductAdmin(id: string, permanent: boolean) {
  const product = await ProductModel.findById(id);
  if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');

  if (permanent) {
    const referencedOrders = await OrderModel.countDocuments({ 'items.productId': product._id });
    if (referencedOrders > 0) {
      throw new AppError(
        409,
        'PRODUCT_HAS_ORDERS',
        `Cannot permanently delete product linked to ${referencedOrders} historical orders. Archive it instead.`,
      );
    }
    const summary = { id: String(product._id), name: product.name, sku: product.sku };
    await product.deleteOne();
    return { deleted: true, archived: false, ...summary };
  }

  product.status = 'archived';
  await product.save();
  return { deleted: false, archived: true, id: String(product._id), name: product.name, sku: product.sku };
}

export async function duplicateProductAdmin(id: string) {
  const src = await ProductModel.findById(id).lean();
  if (!src) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');

  const suffix = Date.now().toString(36).slice(-4).toUpperCase();
  const { _id, createdAt, updatedAt, soldCount, ratingAverage, reviewCount, ...rest } = src as unknown as Record<string, unknown>;
  void _id;
  void createdAt;
  void updatedAt;
  void soldCount;
  void ratingAverage;
  void reviewCount;

  const duplicated = await ProductModel.create({
    ...rest,
    name: `${src.name} (Copy)`,
    slug: `${src.slug}-copy-${suffix.toLowerCase()}`,
    sku: `${src.sku}-${suffix}`,
    status: 'draft',
    reservedStock: 0,
    variants: (src.variants || []).map((v: { sku: string; _id?: unknown; [k: string]: unknown }, idx: number) => ({
      ...v,
      _id: undefined,
      sku: `${v.sku}-${suffix}-${idx + 1}`,
      reservedStock: 0,
    })),
  });

  return {
    product: enrichProductPricing(duplicated.toObject({ flattenMaps: true }) as unknown as Record<string, unknown>),
    sourceName: src.name,
    sku: duplicated.sku,
    id: String(duplicated._id),
  };
}

export async function exportProductsCsv() {
  const products = await ProductModel.find({ status: { $ne: 'archived' } }).populate('categoryId', 'slug').lean();
  const header = 'sku,name,slug,categorySlug,brandName,basePrice,salePrice,stockOnHand,status,description';
  const escapeCsv = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const rows = products.map((p) =>
    [
      escapeCsv(p.sku),
      escapeCsv(p.name),
      escapeCsv(p.slug),
      escapeCsv((p.categoryId as unknown as { slug?: string })?.slug || 'general'),
      escapeCsv(p.brandName || ''),
      p.basePrice,
      p.salePrice ?? '',
      p.stockOnHand,
      p.status,
      escapeCsv(p.description),
    ].join(','),
  );
  return [header, ...rows].join('\n');
}

export async function bulkImportProductsAdmin(input: z.infer<typeof bulkImportSchema>) {
  const categories = await CategoryModel.find().lean();
  const catSlugMap = new Map(categories.map((c) => [c.slug, c]));

  const errors: Array<{ row: number; sku: string; error: string }> = [];
  const seenSkus = new Set<string>();
  const validOps = [];

  for (let i = 0; i < input.rows.length; i += 1) {
    const row = input.rows[i];
    if (seenSkus.has(row.sku)) {
      errors.push({ row: i + 1, sku: row.sku, error: 'Duplicate SKU inside CSV file.' });
      continue;
    }
    seenSkus.add(row.sku);

    const cat = catSlugMap.get(row.categorySlug.toLowerCase());
    if (!cat) {
      errors.push({ row: i + 1, sku: row.sku, error: `Category slug "${row.categorySlug}" not found.` });
      continue;
    }

    const existingSku = await ProductModel.findOne({ sku: row.sku }).select('_id').lean();
    if (existingSku) {
      errors.push({ row: i + 1, sku: row.sku, error: `SKU "${row.sku}" already exists in catalog.` });
      continue;
    }

    validOps.push({
      name: row.name,
      slug: row.slug,
      sku: row.sku,
      categoryId: cat._id,
      categoryPath: buildCategoryAncestryPath({
        categoryId: String(cat._id),
        allCategories: categories,
      }),
      brandName: row.brandName || '',
      basePrice: row.basePrice,
      salePrice: row.salePrice ?? null,
      stockOnHand: row.stockOnHand,
      status: row.status,
      description: row.description,
    });
  }

  let insertedCount = 0;
  if (validOps.length > 0) {
    const inserted = await ProductModel.insertMany(validOps, { ordered: false });
    insertedCount = inserted.length;
  }

  return { importedCount: insertedCount, errors };
}

export async function bulkProductActionAdmin(parsed: z.infer<typeof bulkActionSchema>) {
  let modifiedCount = 0;
  if (parsed.action === 'delete') {
    const linked = await OrderModel.distinct('items.productId', { 'items.productId': { $in: parsed.ids } });
    const linkedSet = new Set(linked.map(String));
    const deletableIds = parsed.ids.filter((id) => !linkedSet.has(id));
    const archiveIds = parsed.ids.filter((id) => linkedSet.has(id));
    if (deletableIds.length > 0) {
      const delRes = await ProductModel.deleteMany({ _id: { $in: deletableIds } });
      modifiedCount += delRes.deletedCount || 0;
    }
    if (archiveIds.length > 0) {
      const arcRes = await ProductModel.updateMany({ _id: { $in: archiveIds } }, { $set: { status: 'archived' } });
      modifiedCount += arcRes.modifiedCount || 0;
    }
  } else {
    const statusMap: Record<string, 'published' | 'draft' | 'archived'> = {
      publish: 'published',
      draft: 'draft',
      archive: 'archived',
    };
    const resUpdate = await ProductModel.updateMany(
      { _id: { $in: parsed.ids } },
      { $set: { status: statusMap[parsed.action] } },
    );
    modifiedCount = resUpdate.modifiedCount || 0;
  }
  return { modifiedCount };
}

export async function listAttributesAdmin() {
  const attributes = await ProductAttributePresetModel.find().sort({ group: 1, name: 1 }).lean();
  return attributes.map((a) => ({ ...a, id: String(a._id) }));
}

export async function createAttributeAdmin(parsed: z.infer<typeof attributePresetSchema>) {
  const attr = await ProductAttributePresetModel.create(parsed);
  return { ...attr.toObject(), id: String(attr._id) };
}

export async function updateAttributeAdmin(id: string, parsed: z.infer<typeof attributePresetSchema>) {
  const updated = await ProductAttributePresetModel.findByIdAndUpdate(id, { $set: parsed }, { new: true });
  if (!updated) throw new AppError(404, 'ATTRIBUTE_NOT_FOUND', 'Attribute preset not found.');
  return { ...updated.toObject(), id: String(updated._id) };
}

export async function deleteAttributeAdmin(id: string) {
  await ProductAttributePresetModel.findByIdAndDelete(id);
  return { deleted: true };
}
