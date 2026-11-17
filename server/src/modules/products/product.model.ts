import mongoose, { Schema, type Document } from 'mongoose';

export interface IProductImage {
  url: string;
  publicId?: string;
  alt: string;
  sortOrder: number;
}

export interface IProductVariant {
  _id: mongoose.Types.ObjectId;
  sku: string;
  title: string;
  options: Record<string, string>;
  price?: number | null;
  salePrice?: number | null;
  stockOnHand: number;
  reservedStock: number;
  lowStockThreshold: number;
  imageUrl?: string;
  isActive: boolean;
}

export interface IProduct extends Document {
  name: string;
  nameBn?: string;
  slug: string;
  sku: string;
  barcode?: string;
  brandId?: mongoose.Types.ObjectId | null;
  brandName?: string;
  categoryId: mongoose.Types.ObjectId;
  subCategoryId?: mongoose.Types.ObjectId | null;
  categoryPath: string[];
  description: string;
  shortDescription?: string;
  features: string[];
  attributeGroup: 'general' | 'electronics' | 'beauty' | 'books' | 'home';
  attributes: Record<string, string>;
  specifications: Array<{ label: string; value: string }>;
  bilingualKeywords: string[];
  basePrice: number;
  costPrice?: number | null;
  salePrice?: number | null;
  flashSalePrice?: number | null;
  flashSaleStartsAt?: Date | null;
  flashSaleEndsAt?: Date | null;
  stockOnHand: number;
  reservedStock: number;
  lowStockThreshold: number;
  weight?: number | null;
  dimensions?: {
    length?: number | null;
    width?: number | null;
    height?: number | null;
  };
  tags: string[];
  hasVariants: boolean;
  variantOptions: Array<{ name: string; values: string[] }>;
  variants: IProductVariant[];
  images: IProductImage[];
  warrantyInfo?: string;
  returnPolicyNote?: string;
  faqs: Array<{ question: string; answer: string }>;
  status: 'draft' | 'published' | 'archived';
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  isPremiumCollection: boolean;
  soldCount: number;
  ratingAverage: number;
  reviewCount: number;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ProductVariantSchema = new Schema<IProductVariant>(
  {
    sku: { type: String, required: true, trim: true, uppercase: true },
    title: { type: String, required: true, trim: true },
    options: { type: Map, of: String, default: {} },
    price: { type: Number, min: 0, default: null },
    salePrice: { type: Number, min: 0, default: null },
    stockOnHand: { type: Number, required: true, min: 0, default: 0 },
    reservedStock: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    imageUrl: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { _id: true },
);

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, maxlength: 180 },
    nameBn: { type: String, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    barcode: { type: String, trim: true },
    brandId: { type: Schema.Types.ObjectId, ref: 'Brand', default: null, index: true },
    brandName: { type: String, trim: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    subCategoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    categoryPath: { type: [String], default: [] },
    description: { type: String, required: true },
    shortDescription: { type: String, maxlength: 400 },
    features: { type: [String], default: [] },
    attributeGroup: {
      type: String,
      enum: ['general', 'electronics', 'beauty', 'books', 'home'],
      default: 'general',
    },
    attributes: { type: Map, of: String, default: {} },
    specifications: {
      type: [{ label: { type: String, required: true }, value: { type: String, required: true } }],
      default: [],
    },
    bilingualKeywords: { type: [String], default: [], index: true },
    basePrice: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, min: 0, default: null },
    salePrice: { type: Number, min: 0, default: null },
    flashSalePrice: { type: Number, min: 0, default: null },
    flashSaleStartsAt: { type: Date, default: null },
    flashSaleEndsAt: { type: Date, default: null },
    stockOnHand: { type: Number, required: true, min: 0, default: 0 },
    reservedStock: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    weight: { type: Number, min: 0, default: null },
    dimensions: {
      length: { type: Number, min: 0, default: null },
      width: { type: Number, min: 0, default: null },
      height: { type: Number, min: 0, default: null },
    },
    tags: { type: [String], default: [] },
    hasVariants: { type: Boolean, default: false },
    variantOptions: {
      type: [{ name: { type: String, required: true }, values: { type: [String], default: [] } }],
      default: [],
    },
    variants: { type: [ProductVariantSchema], default: [] },
    images: {
      type: [
        {
          url: { type: String, required: true },
          publicId: { type: String },
          alt: { type: String, default: '' },
          sortOrder: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
    warrantyInfo: { type: String, maxlength: 300 },
    returnPolicyNote: { type: String, maxlength: 300 },
    faqs: {
      type: [{ question: { type: String, required: true }, answer: { type: String, required: true } }],
      default: [],
    },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    isNewArrival: { type: Boolean, default: false, index: true },
    isBestSeller: { type: Boolean, default: false, index: true },
    isPremiumCollection: { type: Boolean, default: false, index: true },
    soldCount: { type: Number, default: 0, index: true },
    ratingAverage: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    seoTitle: { type: String, maxlength: 140 },
    seoDescription: { type: String, maxlength: 240 },
    seoKeywords: { type: [String], default: [] },
  },
  { timestamps: true },
);

ProductSchema.index({ name: 'text', nameBn: 'text', description: 'text', brandName: 'text', bilingualKeywords: 'text', sku: 'text' });
ProductSchema.index({ 'variants.sku': 1 }, { unique: true, sparse: true });

export const ProductModel = mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);
