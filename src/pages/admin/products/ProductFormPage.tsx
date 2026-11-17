import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { AdminLayout, PermissionGuard } from '../../../layouts/AdminLayout';
import { AdminPageHeader, ErrorBanner, LoadingCards } from '../../../components/admin/ui';
import { CloudinaryImageField } from '../../../components/admin/CloudinaryImageField';
import { apiRequest } from '../../../services/api';
import { useAppDispatch } from '../../../app/hooks';
import { showToast } from '../../../features/notifications/toastSlice';
import type { BrandItem, CategoryItem, ProductItem } from '../../../types/commerce';
import { toLocalDateTimeInputValue } from '../../../lib/dateTime';
import { useSeoMeta } from '../../../lib/useSeoMeta';

function slugify(val: string) {
  return val
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const ATTRIBUTE_PRESETS: Record<ProductItem['attributeGroup'], string[]> = {
  general: ['Material', 'Origin', 'Weight'],
  electronics: ['Processor', 'RAM / Storage', 'Display', 'Battery', 'Warranty'],
  beauty: ['Skin Type', 'Ingredients', 'Net Volume', 'Expiry Window'],
  books: ['Author', 'Publisher', 'Language', 'Edition', 'ISBN'],
  home: ['Dimensions', 'Capacity / Wattage', 'Material', 'Warranty'],
};

interface VariantRow {
  _id?: string;
  sku: string;
  title: string;
  options?: Record<string, string>;
  imageUrl?: string;
  price: string;
  salePrice: string;
  stockOnHand: string;
  lowStockThreshold: string;
}

export function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  useSeoMeta({ title: `${isEdit ? 'Edit' : 'Add'} Product | NOVARA Admin`, noIndex: true });

  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [nameBn, setNameBn] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(isEdit);
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [attributeGroup, setAttributeGroup] = useState<ProductItem['attributeGroup']>('general');
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');

  const [basePrice, setBasePrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [flashSalePrice, setFlashSalePrice] = useState('');
  const [flashSaleStartsAt, setFlashSaleStartsAt] = useState('');
  const [flashSaleEndsAt, setFlashSaleEndsAt] = useState('');

  const [stockOnHand, setStockOnHand] = useState('10');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [weight, setWeight] = useState('');
  const [dimLength, setDimLength] = useState('');
  const [dimWidth, setDimWidth] = useState('');
  const [dimHeight, setDimHeight] = useState('');

  const [imageUrl, setImageUrl] = useState('');
  const [imagePublicId, setImagePublicId] = useState('');
  const [extraImages, setExtraImages] = useState<Array<{ url: string; publicId?: string; alt?: string }>>([]);

  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<VariantRow[]>([]);

  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('published');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isNewArrival, setIsNewArrival] = useState(false);
  const [isBestSeller, setIsBestSeller] = useState(false);
  const [isPremiumCollection, setIsPremiumCollection] = useState(false);

  const [warrantyInfo, setWarrantyInfo] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [bilingualKeywordsText, setBilingualKeywordsText] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywordsText, setSeoKeywordsText] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const [catRes, brandRes] = await Promise.all([
          apiRequest<{ ok: true; categories: CategoryItem[] }>('/api/admin/categories'),
          apiRequest<{ ok: true; brands: BrandItem[] }>('/api/admin/brands'),
        ]);
        if (cancelled) return;
        const cats = catRes.categories || [];
        setCategories(cats);
        setBrands(brandRes.brands || []);

        if (id) {
          const prodRes = await apiRequest<{ ok: true; product: ProductItem }>(`/api/admin/products/${id}`);
          if (cancelled) return;
          const p = prodRes.product;
          const cId = p.categoryId ? (typeof p.categoryId === 'object' ? p.categoryId._id : p.categoryId) : '';
          const subId =
            p.subCategoryId && typeof p.subCategoryId === 'object'
              ? (p.subCategoryId as { _id: string })._id
              : p.subCategoryId || '';
          const bId = p.brandId && typeof p.brandId === 'object' ? p.brandId._id : p.brandId || '';

          setName(p.name || '');
          setNameBn(p.nameBn || '');
          setSlug(p.slug || '');
          setSlugManuallyEdited(true);
          setSku(p.sku || '');
          setCategoryId(cId || cats[0]?.id || '');
          setSubCategoryId(subId);
          setBrandId(bId);
          setAttributeGroup(p.attributeGroup || 'general');
          setAttributes(p.attributes || {});
          setShortDescription(p.shortDescription || '');
          setDescription(p.description || '');
          setBasePrice(String(p.basePrice ?? ''));
          setCostPrice(p.costPrice != null ? String(p.costPrice) : '');
          setSalePrice(p.salePrice != null ? String(p.salePrice) : '');
          setFlashSalePrice(p.flashSalePrice != null ? String(p.flashSalePrice) : '');
          setFlashSaleStartsAt(toLocalDateTimeInputValue(p.flashSaleStartsAt));
          setFlashSaleEndsAt(toLocalDateTimeInputValue(p.flashSaleEndsAt));
          setStockOnHand(String(p.stockOnHand ?? 0));
          setLowStockThreshold(String(p.lowStockThreshold ?? 5));
          setWeight(p.weight != null ? String(p.weight) : '');
          setDimLength(p.dimensions?.length != null ? String(p.dimensions.length) : '');
          setDimWidth(p.dimensions?.width != null ? String(p.dimensions.width) : '');
          setDimHeight(p.dimensions?.height != null ? String(p.dimensions.height) : '');
          setImageUrl(p.images?.[0]?.url || '');
          setImagePublicId(p.images?.[0]?.publicId || '');
          setExtraImages((p.images || []).slice(1).map((img) => ({ url: img.url, publicId: img.publicId, alt: img.alt })));
          setHasVariants(Boolean(p.hasVariants && p.variants?.length));
          setVariants(
            (p.variants || []).map((v) => ({
              _id: v._id,
              sku: v.sku,
              title: v.title,
              options: v.options || {},
              imageUrl: v.imageUrl,
              price: v.price != null ? String(v.price) : '',
              salePrice: v.salePrice != null ? String(v.salePrice) : '',
              stockOnHand: String(v.stockOnHand ?? 0),
              lowStockThreshold: String(v.lowStockThreshold ?? 5),
            })),
          );
          setStatus(p.status);
          setIsFeatured(Boolean(p.isFeatured));
          setIsNewArrival(Boolean(p.isNewArrival));
          setIsBestSeller(Boolean(p.isBestSeller));
          setIsPremiumCollection(Boolean(p.isPremiumCollection));
          setWarrantyInfo(p.warrantyInfo || '');
          setTagsText((p.tags || []).join(', '));
          setBilingualKeywordsText((p.bilingualKeywords || []).join(', '));
          setSeoTitle(p.seoTitle || '');
          setSeoDescription(p.seoDescription || '');
          setSeoKeywordsText((p.seoKeywords || []).join(', '));
        } else {
          const defaultCat = cats.find((c) => !c.parentId) || cats[0];
          setName('');
          setNameBn('');
          setSlug('');
          setSlugManuallyEdited(false);
          setSku('');
          setCategoryId(defaultCat?.id || '');
          setSubCategoryId('');
          setBrandId('');
          setAttributeGroup('general');
          setAttributes({});
          setShortDescription('');
          setDescription('');
          setBasePrice('');
          setCostPrice('');
          setSalePrice('');
          setFlashSalePrice('');
          setFlashSaleStartsAt('');
          setFlashSaleEndsAt('');
          setStockOnHand('10');
          setLowStockThreshold('5');
          setWeight('');
          setDimLength('');
          setDimWidth('');
          setDimHeight('');
          setImageUrl('');
          setImagePublicId('');
          setExtraImages([]);
          setHasVariants(false);
          setVariants([]);
          setStatus('published');
          setIsFeatured(false);
          setIsNewArrival(false);
          setIsBestSeller(false);
          setIsPremiumCollection(false);
          setWarrantyInfo('');
          setTagsText('');
          setBilingualKeywordsText('');
          setSeoTitle('');
          setSeoDescription('');
          setSeoKeywordsText('');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load product data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const topCategories = categories.filter((c) => !c.parentId);
  const subCategories = categories.filter((c) => c.parentId === categoryId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!categoryId) {
      dispatch(showToast({ variant: 'warning', message: 'Please select a primary category.' }));
      return;
    }
    setSaving(true);
    try {
      const gallery = [
        ...(imageUrl.trim() ? [{ url: imageUrl.trim(), publicId: imagePublicId || undefined, alt: name, sortOrder: 0 }] : []),
        ...extraImages
          .filter((img) => img.url.trim())
          .map((img, i) => ({ url: img.url.trim(), publicId: img.publicId || undefined, alt: img.alt || name, sortOrder: i + 1 })),
      ];

      const dims = {
        length: dimLength ? Number(dimLength) : null,
        width: dimWidth ? Number(dimWidth) : null,
        height: dimHeight ? Number(dimHeight) : null,
      };

      const payload = {
        name: name.trim(),
        nameBn: nameBn.trim(),
        slug: (slug.trim() || slugify(name)).toLowerCase(),
        sku: sku.trim().toUpperCase(),
        categoryId,
        subCategoryId: subCategoryId || null,
        brandId: brandId || null,
        attributeGroup,
        attributes,
        shortDescription: shortDescription.trim(),
        description: description.trim(),
        basePrice: Number(basePrice || 0),
        costPrice: costPrice ? Number(costPrice) : null,
        salePrice: salePrice ? Number(salePrice) : null,
        flashSalePrice: flashSalePrice ? Number(flashSalePrice) : null,
        flashSaleStartsAt: flashSaleStartsAt ? new Date(flashSaleStartsAt).toISOString() : null,
        flashSaleEndsAt: flashSaleEndsAt ? new Date(flashSaleEndsAt).toISOString() : null,
        stockOnHand: Number(stockOnHand || 0),
        lowStockThreshold: Number(lowStockThreshold || 5),
        weight: weight ? Number(weight) : null,
        dimensions: dims,
        tags: tagsText.split(',').map((s) => s.trim()).filter(Boolean),
        warrantyInfo: warrantyInfo.trim(),
        seoTitle: seoTitle.trim(),
        seoDescription: seoDescription.trim(),
        seoKeywords: seoKeywordsText.split(',').map((s) => s.trim()).filter(Boolean),
        status,
        isFeatured,
        isNewArrival,
        isBestSeller,
        isPremiumCollection,
        bilingualKeywords: bilingualKeywordsText.split(',').map((s) => s.trim()).filter(Boolean),
        images: gallery,
        hasVariants: hasVariants && variants.length > 0,
        variants: hasVariants
          ? variants.map((v) => ({
              ...(v._id ? { _id: v._id } : {}),
              sku: v.sku.trim().toUpperCase(),
              title: v.title.trim(),
              options: v.options && Object.keys(v.options).length > 0 ? v.options : { Variant: v.title.trim() },
              price: v.price ? Number(v.price) : null,
              salePrice: v.salePrice ? Number(v.salePrice) : null,
              stockOnHand: Number(v.stockOnHand || 0),
              lowStockThreshold: Number(v.lowStockThreshold || 5),
              ...(v.imageUrl ? { imageUrl: v.imageUrl } : {}),
              isActive: true,
            }))
          : [],
      };

      if (isEdit && id) {
        await apiRequest(`/api/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        dispatch(showToast({ variant: 'success', message: 'Product updated & synced with storefront.' }));
      } else {
        await apiRequest('/api/admin/products', { method: 'POST', body: JSON.stringify(payload) });
        dispatch(showToast({ variant: 'success', message: 'Product created & published to catalog.' }));
      }
      navigate('/admin/products');
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Unable to save product.' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <PermissionGuard permission="catalog.manage">
        <div className="space-y-5 max-w-[1200px] mx-auto">
          <AdminPageHeader
            title={isEdit ? 'Edit Product' : 'Add New Product'}
            subtitle="Configure product details, pricing, stock, Cloudinary gallery, variants, and SEO metadata."
            breadcrumbs={[
              { label: 'Product Management' },
              { label: 'All Products', to: '/admin/products' },
              { label: isEdit ? 'Edit Product' : 'Add Product' },
            ]}
            actions={
              <Link
                to="/admin/products"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-white dark:bg-[#0B1730] px-3.5 py-2 text-xs font-semibold text-[#101B35] dark:text-slate-200 hover:bg-slate-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Products
              </Link>
            }
          />

          {error && <ErrorBanner message={error} />}
          {loading ? (
            <LoadingCards count={4} />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Basic Details */}
              <div className="rounded-2xl border border-[#E4EAF5] dark:border-slate-800 bg-white dark:bg-[#0B1730] p-5 shadow-xs space-y-4">
                <h2 className="font-display text-sm font-bold text-[#101B35] dark:text-white">Core Information</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#101B35] dark:text-slate-200">
                      Product Name (English) *
                    </label>
                    <input
                      required
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (!isEdit && !slugManuallyEdited) setSlug(slugify(e.target.value));
                      }}
                      className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs text-[#101B35] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#101B35] dark:text-slate-200">
                      Product Name (Bangla / বাংলা)
                    </label>
                    <input
                      value={nameBn}
                      onChange={(e) => setNameBn(e.target.value)}
                      className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs text-[#101B35] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#101B35] dark:text-slate-200">
                      URL Slug *
                    </label>
                    <input
                      required
                      value={slug}
                      onChange={(e) => {
                        setSlugManuallyEdited(true);
                        setSlug(slugify(e.target.value));
                      }}
                      className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 font-mono-tabular text-xs text-[#101B35] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#101B35] dark:text-slate-200">
                      SKU *
                    </label>
                    <input
                      required
                      value={sku}
                      onChange={(e) => setSku(e.target.value.toUpperCase())}
                      className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 font-mono-tabular text-xs text-[#101B35] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#101B35] dark:text-slate-200">
                      Category *
                    </label>
                    <select
                      required
                      value={categoryId}
                      onChange={(e) => {
                        setCategoryId(e.target.value);
                        setSubCategoryId('');
                      }}
                      className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs text-[#101B35] dark:text-white"
                    >
                      <option value="">Select Category</option>
                      {topCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#101B35] dark:text-slate-200">
                      Subcategory
                    </label>
                    <select
                      value={subCategoryId}
                      onChange={(e) => setSubCategoryId(e.target.value)}
                      className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs text-[#101B35] dark:text-white"
                    >
                      <option value="">None</option>
                      {subCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#101B35] dark:text-slate-200">
                      Brand
                    </label>
                    <select
                      value={brandId}
                      onChange={(e) => setBrandId(e.target.value)}
                      className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs text-[#101B35] dark:text-white"
                    >
                      <option value="">Generic / Unbranded</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#101B35] dark:text-slate-200">
                      Publish Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as 'draft' | 'published' | 'archived')}
                      className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs text-[#101B35] dark:text-white"
                    >
                      <option value="published">Published (Live)</option>
                      <option value="draft">Draft</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#101B35] dark:text-slate-200">
                    Short Summary
                  </label>
                  <input
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    placeholder="Concise highlight displayed beneath product title"
                    className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs text-[#101B35] dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#101B35] dark:text-slate-200">
                    Full Description *
                  </label>
                  <textarea
                    required
                    minLength={10}
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 p-3 text-xs text-[#101B35] dark:text-white"
                  />
                </div>
              </div>

              {/* Pricing & Stock */}
              <div className="rounded-2xl border border-[#E4EAF5] dark:border-slate-800 bg-white dark:bg-[#0B1730] p-5 shadow-xs space-y-4">
                <h2 className="font-display text-sm font-bold text-[#101B35] dark:text-white">Pricing, Flash Sale & Inventory</h2>
                <div className="grid gap-4 sm:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#101B35] dark:text-slate-200">Base Price (৳) *</label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={basePrice}
                      onChange={(e) => setBasePrice(e.target.value)}
                      className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 font-mono-tabular text-xs text-[#101B35] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#101B35] dark:text-slate-200">Sale Price (৳)</label>
                    <input
                      type="number"
                      min={0}
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                      className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 font-mono-tabular text-xs text-[#101B35] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#101B35] dark:text-slate-200">Cost Price (৳)</label>
                    <input
                      type="number"
                      min={0}
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 font-mono-tabular text-xs text-[#101B35] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#101B35] dark:text-slate-200">Stock On Hand *</label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={stockOnHand}
                      onChange={(e) => setStockOnHand(e.target.value)}
                      className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 font-mono-tabular text-xs text-[#101B35] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#101B35] dark:text-slate-200">Flash Sale Price (৳)</label>
                    <input
                      type="number"
                      min={0}
                      value={flashSalePrice}
                      onChange={(e) => setFlashSalePrice(e.target.value)}
                      className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 font-mono-tabular text-xs text-[#101B35] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#101B35] dark:text-slate-200">Flash Starts</label>
                    <input
                      type="datetime-local"
                      value={flashSaleStartsAt}
                      onChange={(e) => setFlashSaleStartsAt(e.target.value)}
                      className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs text-[#101B35] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#101B35] dark:text-slate-200">Flash Ends</label>
                    <input
                      type="datetime-local"
                      value={flashSaleEndsAt}
                      onChange={(e) => setFlashSaleEndsAt(e.target.value)}
                      className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs text-[#101B35] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#101B35] dark:text-slate-200">Low Stock Alert</label>
                    <input
                      type="number"
                      min={0}
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(e.target.value)}
                      className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 font-mono-tabular text-xs text-[#101B35] dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-4 pt-2 border-t border-[#E4EAF5] dark:border-slate-800">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#101B35] dark:text-slate-200">Weight (g)</label>
                    <input
                      type="number"
                      min={0}
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="w-full h-9 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 font-mono-tabular text-xs text-[#101B35] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#101B35] dark:text-slate-200">Length (cm)</label>
                    <input
                      type="number"
                      min={0}
                      value={dimLength}
                      onChange={(e) => setDimLength(e.target.value)}
                      className="w-full h-9 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 font-mono-tabular text-xs text-[#101B35] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#101B35] dark:text-slate-200">Width (cm)</label>
                    <input
                      type="number"
                      min={0}
                      value={dimWidth}
                      onChange={(e) => setDimWidth(e.target.value)}
                      className="w-full h-9 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 font-mono-tabular text-xs text-[#101B35] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#101B35] dark:text-slate-200">Height (cm)</label>
                    <input
                      type="number"
                      min={0}
                      value={dimHeight}
                      onChange={(e) => setDimHeight(e.target.value)}
                      className="w-full h-9 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 font-mono-tabular text-xs text-[#101B35] dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Media Gallery */}
              <div className="rounded-2xl border border-[#E4EAF5] dark:border-slate-800 bg-white dark:bg-[#0B1730] p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-sm font-bold text-[#101B35] dark:text-white">Product Gallery (Cloudinary)</h2>
                  <button
                    type="button"
                    onClick={() => setExtraImages((prev) => [...prev, { url: '', alt: '' }])}
                    className="inline-flex items-center gap-1 rounded-xl border border-[#E4EAF5] dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-[#145CFF] hover:bg-[#EAF1FF]/50"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Extra Image
                  </button>
                </div>

                <CloudinaryImageField
                  label="Primary Product Image"
                  folder="novara/products"
                  value={imageUrl}
                  onChange={(url, pubId) => {
                    setImageUrl(url);
                    setImagePublicId(pubId || '');
                  }}
                />

                {extraImages.map((img, idx) => (
                  <div key={idx} className="grid gap-3 sm:grid-cols-[1fr_200px_auto] items-end border-t border-[#E4EAF5] dark:border-slate-800 pt-3">
                    <CloudinaryImageField
                      label={`Gallery Image #${idx + 2}`}
                      folder="novara/products"
                      value={img.url}
                      onChange={(url, pubId) =>
                        setExtraImages((prev) => prev.map((item, i) => (i === idx ? { ...item, url, publicId: pubId } : item)))
                      }
                    />
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#101B35] dark:text-slate-200">Alt Text</label>
                      <input
                        value={img.alt || ''}
                        onChange={(e) =>
                          setExtraImages((prev) => prev.map((item, i) => (i === idx ? { ...item, alt: e.target.value } : item)))
                        }
                        className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs text-[#101B35] dark:text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setExtraImages((prev) => prev.filter((_, i) => i !== idx))}
                      className="h-10 rounded-xl border border-rose-200 px-3 text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Variants */}
              <div className="rounded-2xl border border-[#E4EAF5] dark:border-slate-800 bg-white dark:bg-[#0B1730] p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-sm font-bold text-[#101B35] dark:text-white">Product Variants</h2>
                    <p className="text-xs text-[#64748B] dark:text-slate-400">Enable color, size, or capacity options with separate SKU & stock.</p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#101B35] dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={hasVariants}
                      onChange={(e) => setHasVariants(e.target.checked)}
                      className="h-4 w-4 rounded text-[#145CFF]"
                    />
                    Has Variants
                  </label>
                </div>

                {hasVariants && (
                  <div className="space-y-3">
                    {variants.map((v, idx) => (
                      <div key={idx} className="grid gap-2 sm:grid-cols-6 items-end rounded-xl border border-[#E4EAF5] dark:border-slate-800 bg-[#F8FAFF] dark:bg-slate-900/50 p-3">
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold">Variant SKU *</label>
                          <input
                            required
                            value={v.sku}
                            onChange={(e) =>
                              setVariants((prev) => prev.map((r, i) => (i === idx ? { ...r, sku: e.target.value } : r)))
                            }
                            className="w-full h-9 rounded-lg border border-[#E4EAF5] dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold">Option Title *</label>
                          <input
                            required
                            placeholder="e.g. Obsidian 256GB"
                            value={v.title}
                            onChange={(e) =>
                              setVariants((prev) => prev.map((r, i) => (i === idx ? { ...r, title: e.target.value } : r)))
                            }
                            className="w-full h-9 rounded-lg border border-[#E4EAF5] dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold">Price (৳)</label>
                          <input
                            type="number"
                            value={v.price}
                            onChange={(e) =>
                              setVariants((prev) => prev.map((r, i) => (i === idx ? { ...r, price: e.target.value } : r)))
                            }
                            className="w-full h-9 rounded-lg border border-[#E4EAF5] dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold">Sale (৳)</label>
                          <input
                            type="number"
                            value={v.salePrice}
                            onChange={(e) =>
                              setVariants((prev) => prev.map((r, i) => (i === idx ? { ...r, salePrice: e.target.value } : r)))
                            }
                            className="w-full h-9 rounded-lg border border-[#E4EAF5] dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold">Stock *</label>
                          <input
                            type="number"
                            required
                            value={v.stockOnHand}
                            onChange={(e) =>
                              setVariants((prev) => prev.map((r, i) => (i === idx ? { ...r, stockOnHand: e.target.value } : r)))
                            }
                            className="w-full h-9 rounded-lg border border-[#E4EAF5] dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setVariants((prev) => prev.filter((_, i) => i !== idx))}
                          className="h-9 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setVariants((prev) => [
                          ...prev,
                          { sku: `${sku || 'SKU'}-V${prev.length + 1}`, title: '', price: basePrice, salePrice: '', stockOnHand: '10', lowStockThreshold: '5' },
                        ])
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4EAF5] dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-[#145CFF]"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Variant Row
                    </button>
                  </div>
                )}
              </div>

              {/* Attributes, Merchandising Flags & SEO */}
              <div className="rounded-2xl border border-[#E4EAF5] dark:border-slate-800 bg-white dark:bg-[#0B1730] p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-sm font-bold text-[#101B35] dark:text-white">Attributes, Badges & SEO</h2>
                  <select
                    value={attributeGroup}
                    onChange={(e) => setAttributeGroup(e.target.value as ProductItem['attributeGroup'])}
                    className="h-9 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs"
                  >
                    <option value="general">General Attributes</option>
                    <option value="electronics">Electronics Specs</option>
                    <option value="beauty">Beauty & Care Specs</option>
                    <option value="books">Books Specs</option>
                    <option value="home">Home & Appliances Specs</option>
                  </select>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ...ATTRIBUTE_PRESETS[attributeGroup],
                    ...Object.keys(attributes).filter((k) => !ATTRIBUTE_PRESETS[attributeGroup].includes(k)),
                  ].map((attrKey) => (
                    <div key={attrKey}>
                      <label className="mb-1 block text-xs font-semibold text-[#64748B]">{attrKey}</label>
                      <input
                        value={attributes[attrKey] || ''}
                        onChange={(e) => setAttributes((prev) => ({ ...prev, [attrKey]: e.target.value }))}
                        className="w-full h-9 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-5 pt-2 border-t border-[#E4EAF5] dark:border-slate-800 text-xs font-semibold">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="h-4 w-4 rounded text-[#145CFF]" />
                    Featured Product
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={isNewArrival} onChange={(e) => setIsNewArrival(e.target.checked)} className="h-4 w-4 rounded text-[#145CFF]" />
                    New Arrival
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={isBestSeller} onChange={(e) => setIsBestSeller(e.target.checked)} className="h-4 w-4 rounded text-[#145CFF]" />
                    Best Seller
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={isPremiumCollection} onChange={(e) => setIsPremiumCollection(e.target.checked)} className="h-4 w-4 rounded text-[#145CFF]" />
                    Premium Collection
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-[#E4EAF5] dark:border-slate-800">
                  <div>
                    <label className="mb-1 block text-xs font-semibold">Tags (comma separated)</label>
                    <input
                      value={tagsText}
                      onChange={(e) => setTagsText(e.target.value)}
                      className="w-full h-9 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold">Bilingual Search Keywords (Bangla + Banglish)</label>
                    <input
                      value={bilingualKeywordsText}
                      onChange={(e) => setBilingualKeywordsText(e.target.value)}
                      placeholder="স্মার্টফোন, phone, mobile"
                      className="w-full h-9 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold">Warranty Info</label>
                    <input
                      value={warrantyInfo}
                      onChange={(e) => setWarrantyInfo(e.target.value)}
                      className="w-full h-9 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold">SEO Title</label>
                    <input
                      value={seoTitle}
                      onChange={(e) => setSeoTitle(e.target.value)}
                      className="w-full h-9 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold">SEO Description</label>
                    <input
                      value={seoDescription}
                      onChange={(e) => setSeoDescription(e.target.value)}
                      className="w-full h-9 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold">SEO Keywords (comma separated)</label>
                    <input
                      value={seoKeywordsText}
                      onChange={(e) => setSeoKeywordsText(e.target.value)}
                      className="w-full h-9 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <Link
                  to="/admin/products"
                  className="rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-white dark:bg-[#0B1730] px-5 py-2.5 text-xs font-semibold text-[#101B35] dark:text-slate-200"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#145CFF] px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#0E47D9] disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          )}
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}
