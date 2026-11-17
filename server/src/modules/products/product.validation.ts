import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().trim().min(2).max(180),
  nameBn: z.string().trim().max(200).optional(),
  slug: z.string().trim().min(2).max(200).toLowerCase(),
  sku: z.string().trim().min(2).max(60).toUpperCase(),
  barcode: z.string().trim().max(60).optional(),
  brandId: z.string().nullable().optional(),
  brandName: z.string().trim().optional(),
  categoryId: z.string().min(1),
  subCategoryId: z.string().nullable().optional(),
  description: z.string().min(10),
  shortDescription: z.string().max(400).optional(),
  features: z.array(z.string()).default([]),
  attributeGroup: z.enum(['general', 'electronics', 'beauty', 'books', 'home']).default('general'),
  attributes: z.record(z.string(), z.string()).default({}),
  specifications: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
  bilingualKeywords: z.array(z.string()).default([]),
  basePrice: z.number().min(0),
  costPrice: z.number().min(0).nullable().optional(),
  salePrice: z.number().min(0).nullable().optional(),
  flashSalePrice: z.number().min(0).nullable().optional(),
  flashSaleStartsAt: z.string().nullable().optional(),
  flashSaleEndsAt: z.string().nullable().optional(),
  stockOnHand: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  weight: z.number().min(0).nullable().optional(),
  dimensions: z
    .object({
      length: z.number().min(0).nullable().optional(),
      width: z.number().min(0).nullable().optional(),
      height: z.number().min(0).nullable().optional(),
    })
    .optional(),
  tags: z.array(z.string()).default([]),
  hasVariants: z.boolean().default(false),
  variantOptions: z
    .array(z.object({ name: z.string().trim().min(1), values: z.array(z.string()).default([]) }))
    .default([]),
  variants: z
    .array(
      z.object({
        _id: z.string().optional(),
        sku: z.string().trim().min(2).toUpperCase(),
        title: z.string().trim().min(1),
        options: z.record(z.string(), z.string()).default({}),
        price: z.number().min(0).nullable().optional(),
        salePrice: z.number().min(0).nullable().optional(),
        stockOnHand: z.number().int().min(0).default(0),
        lowStockThreshold: z.number().int().min(0).default(5),
        imageUrl: z.string().optional(),
        isActive: z.boolean().default(true),
      }),
    )
    .default([]),
  images: z
    .array(
      z.object({
        url: z.string().min(1),
        publicId: z.string().optional(),
        alt: z.string().default(''),
        sortOrder: z.number().default(0),
      }),
    )
    .default([]),
  warrantyInfo: z.string().max(300).optional(),
  returnPolicyNote: z.string().max(300).optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  isFeatured: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  isPremiumCollection: z.boolean().default(false),
  seoTitle: z.string().max(140).optional(),
  seoDescription: z.string().max(240).optional(),
  seoKeywords: z.array(z.string()).default([]),
});

export const productStatusSchema = z.object({
  status: z.enum(['draft', 'published', 'archived']),
});

export const bulkImportSchema = z.object({
  rows: z
    .array(
      z.object({
        sku: z.string().trim().min(2).toUpperCase(),
        name: z.string().trim().min(2),
        slug: z.string().trim().min(2).toLowerCase(),
        categorySlug: z.string().trim().min(1),
        brandName: z.string().optional(),
        basePrice: z.number().min(0),
        salePrice: z.number().min(0).nullable().optional(),
        stockOnHand: z.number().int().min(0),
        status: z.enum(['draft', 'published']).default('draft'),
        description: z.string().min(5),
      }),
    )
    .max(500),
});

export const bulkActionSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum(['publish', 'draft', 'archive', 'delete']),
});

export const attributePresetSchema = z.object({
  name: z.string().trim().min(2).max(80),
  code: z.string().trim().min(2).max(60).toLowerCase(),
  group: z.enum(['general', 'electronics', 'beauty', 'books', 'home']).default('general'),
  values: z.array(z.string().trim().min(1)).default([]),
  isActive: z.boolean().default(true),
});
