import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  Heart,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  Zap,
} from 'lucide-react';
import { apiRequest, isAbortError } from '../services/api';
import type { ProductItem, ProductVariant, ReviewItem } from '../types/commerce';
import { ResilientImage } from '../components/ui/ResilientImage';
import { ProductCard } from '../components/catalog/ProductCard';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { addToCartAsync, openCartDrawer } from '../features/cart/cartSlice';
import { openAuthModal } from '../features/auth/authSlice';
import { showToast } from '../features/notifications/toastSlice';
import { calculateShippingCharge, getDistrictsForDivision, getDivisionNames, getUpazilasForDistrict } from '../lib/bdLocations';
import { formatStoreCurrency } from '../lib/dateTime';
import { computeAvailableStock } from '../lib/orderStateMachine';
import { resolveEffectiveUnitPrice } from '../lib/pricingEngine';
import { useSeoMeta } from '../lib/useSeoMeta';

interface ReviewSummary {
  average: number;
  total: number;
  histogram: Record<number, number>;
}

export function ProductDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const { settings, promotionalAds } = useAppSelector((s) => s.storefront);

  const [product, setProduct] = useState<ProductItem | null>(null);
  const [related, setRelated] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [zoomActive, setZoomActive] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'description' | 'specs' | 'shipping' | 'faqs'>('description');

  // Delivery estimator
  const [estDivision, setEstDivision] = useState('Dhaka');
  const [estDistrict, setEstDistrict] = useState('Dhaka');
  const [estUpazila, setEstUpazila] = useState('Dhanmondi');

  // Reviews
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary>({
    average: 0,
    total: 0,
    histogram: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  });
  const [canReview, setCanReview] = useState(false);
  const [reviewSort, setReviewSort] = useState<'newest' | 'highest' | 'lowest'>('newest');
  const [revRating, setRevRating] = useState(5);
  const [revTitle, setRevTitle] = useState('');
  const [revComment, setRevComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useSeoMeta({
    title: product ? `${product.seoTitle || product.name} | NOVARA COMMERCE` : 'Product Details | NOVARA COMMERCE',
    description: product?.seoDescription || product?.shortDescription || product?.description.slice(0, 155),
    jsonLd: product
      ? {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          sku: selectedVariant?.sku || product.sku,
          description: product.shortDescription || product.description,
          offers: {
            '@type': 'Offer',
            priceCurrency: 'BDT',
            price: product.currentPrice,
            availability: product.availableStock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          },
          ...(reviewSummary.total > 0
            ? {
                aggregateRating: {
                  '@type': 'AggregateRating',
                  ratingValue: reviewSummary.average,
                  reviewCount: reviewSummary.total,
                },
              }
            : {}),
        }
      : undefined,
  });

  const loadProduct = useCallback(
    async (signal?: AbortSignal) => {
      if (!slug) return;
      setLoading(true);
      setError(null);
      try {
        const res = await apiRequest<{ ok: true; product: ProductItem; relatedProducts: ProductItem[] }>(
          `/api/products/${slug}`,
          { signal },
        );
        setProduct(res.product);
        setRelated(Array.isArray(res.relatedProducts) ? res.relatedProducts : []);
        const firstVariant =
          res.product.hasVariants && res.product.variants?.length > 0
            ? res.product.variants.find((v) => v.isActive !== false) || res.product.variants[0]
            : null;
        setSelectedVariant(firstVariant);
        setActiveImageIdx(0);
        setQuantity(1);
      } catch (err) {
        if (isAbortError(err)) return;
        setProduct(null);
        setRelated([]);
        setError(err instanceof Error ? err.message : 'Unable to load product.');
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [slug],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadProduct(controller.signal);
    return () => controller.abort();
  }, [loadProduct]);

  const loadReviews = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await apiRequest<{
        ok: true;
        reviews: ReviewItem[];
        summary: ReviewSummary;
        eligibility: { canReview: boolean };
      }>(`/api/products/${slug}/reviews?sort=${reviewSort}`);
      setReviews(Array.isArray(res.reviews) ? res.reviews : []);
      setReviewSummary(res.summary);
      setCanReview(Boolean(res.eligibility?.canReview));
    } catch {
      // Reviews unavailable when product or DB is offline
    }
  }, [slug, reviewSort]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews, user]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1380px] px-4 py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="h-[460px] animate-pulse rounded-2xl bg-slate-200/70 lg:col-span-6" />
          <div className="h-[460px] animate-pulse rounded-2xl bg-slate-200/70 lg:col-span-6" />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-[#0F1D3A]">Product Unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">{error || 'This product could not be found.'}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          {error && (
            <button
              type="button"
              onClick={() => loadProduct()}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-[#0F1D3A] hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          )}
          <Link to="/shop" className="inline-block rounded-full bg-[#1155EE] px-6 py-2.5 text-sm font-semibold text-white">
            Return to Shop
          </Link>
        </div>
      </div>
    );
  }

  const activePricing = resolveEffectiveUnitPrice({
    basePrice: selectedVariant?.price ?? product.basePrice,
    salePrice: selectedVariant?.salePrice ?? product.salePrice,
    flashSalePrice: product.flashSalePrice,
    flashSaleStartsAt: product.flashSaleStartsAt,
    flashSaleEndsAt: product.flashSaleEndsAt,
  });

  const activeStock = selectedVariant
    ? computeAvailableStock(selectedVariant.stockOnHand, selectedVariant.reservedStock)
    : product.availableStock;

  const activeSku = selectedVariant?.sku || product.sku;
  const galleryImages = [
    ...(selectedVariant?.imageUrl ? [{ url: selectedVariant.imageUrl, alt: selectedVariant.title }] : []),
    ...(product.images || []),
  ];
  const currentImgUrl = galleryImages[activeImageIdx]?.url || '';

  const shippingEstimate = calculateShippingCharge({
    division: estDivision,
    district: estDistrict,
    upazila: estUpazila,
    subtotal: activePricing.currentPrice * quantity,
    config: settings?.shippingSettings,
    deliveryZones: settings?.deliveryZones,
  });
  const freeThreshold = settings?.shippingSettings?.freeShippingThreshold ?? 999;
  const currencyCfg = settings?.currencySettings;
  const productDetailAd = (promotionalAds || []).find((ad) => ad.placement === 'product_detail');

  const handleAddOrBuy = async (buyNow: boolean) => {
    if (activeStock <= 0) {
      dispatch(showToast({ variant: 'warning', message: 'This item is currently out of stock.' }));
      return;
    }

    const res = await dispatch(
      addToCartAsync({
        isAuthenticated: Boolean(user),
        item: {
          productId: product.id,
          variantId: selectedVariant?._id || null,
          slug: product.slug,
          name: product.name,
          sku: activeSku,
          variantTitle: selectedVariant?.title || null,
          imageUrl: currentImgUrl,
          unitPrice: activePricing.currentPrice,
          originalPrice: activePricing.originalPrice,
          quantity,
          availableStock: activeStock,
          isAvailable: true,
        },
      }),
    );

    if (addToCartAsync.rejected.match(res)) {
      dispatch(showToast({ variant: 'error', message: String(res.payload || 'Unable to add item') }));
      return;
    }

    if (buyNow) {
      if (!user) {
        dispatch(
          openAuthModal({
            tab: 'login',
            returnUrl: '/checkout',
            notice: 'Sign in or register to complete your purchase.',
          }),
        );
        return;
      }
      navigate('/checkout');
    } else {
      dispatch(showToast({ variant: 'success', message: `Added ${quantity} × ${product.name} to cart.` }));
      dispatch(openCartDrawer());
    }
  };

  const handleWishlist = async () => {
    if (!user) {
      dispatch(openAuthModal({ tab: 'login', notice: 'Sign in to save items to your wishlist.' }));
      return;
    }
    try {
      const res = await apiRequest<{ ok: true; wishlisted: boolean }>('/api/account/wishlist/toggle', {
        method: 'POST',
        body: JSON.stringify({ productId: product.id }),
      });
      dispatch(showToast({ variant: 'success', message: res.wishlisted ? 'Saved to wishlist.' : 'Removed from wishlist.' }));
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Wishlist error' }));
    }
  };

  const handleReviewSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      const res = await apiRequest<{ ok: true; message: string }>(`/api/products/${product.slug}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating: revRating, title: revTitle, comment: revComment }),
      });
      dispatch(showToast({ variant: 'success', message: res.message }));
      setRevTitle('');
      setRevComment('');
      setCanReview(false);
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Could not submit review' }));
    } finally {
      setSubmittingReview(false);
    }
  };

  const catObj = typeof product.categoryId === 'object' ? product.categoryId : null;

  return (
    <div className="mx-auto max-w-[1380px] px-4 py-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Link to="/" className="hover:text-[#1155EE]">Home</Link>
        <span>/</span>
        <Link to="/shop" className="hover:text-[#1155EE]">Shop</Link>
        {catObj && (
          <>
            <span>/</span>
            <Link to={`/category/${catObj.slug}`} className="hover:text-[#1155EE]">{catObj.name}</Link>
          </>
        )}
        <span>/</span>
        <span className="font-semibold text-[#0F1D3A]">{product.name}</span>
      </nav>

      {/* Main Product Showcase */}
      <div className="grid grid-cols-1 gap-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 lg:grid-cols-12">
        {/* A. Product Media Gallery */}
        <div className="lg:col-span-6">
          <div
            onClick={() => setZoomActive((z) => !z)}
            className="relative aspect-square w-full cursor-zoom-in overflow-hidden rounded-2xl border border-slate-100 bg-[#F8FAFC] p-6"
          >
            {activePricing.discountPercent > 0 && (
              <span className="absolute left-4 top-4 z-10 rounded-full bg-[#1155EE] px-3 py-1 text-xs font-bold text-white">
                Save {activePricing.discountPercent}%
              </span>
            )}
            <ResilientImage
              src={currentImgUrl}
              alt={product.name}
              loading="eager"
              className={`h-full w-full object-contain transition-transform duration-300 ${zoomActive ? 'scale-125' : 'scale-100'}`}
            />
          </div>

          {galleryImages.length > 1 && (
            <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1">
              {galleryImages.map((img, idx) => (
                <button
                  key={`${img.url}-${idx}`}
                  type="button"
                  onClick={() => setActiveImageIdx(idx)}
                  aria-label={`View image ${idx + 1}`}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border p-1 ${
                    activeImageIdx === idx ? 'border-[#1155EE] ring-2 ring-[#1155EE]/20' : 'border-slate-200'
                  }`}
                >
                  <ResilientImage src={img.url} alt={img.alt || product.name} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* B. Identity & Purchase Panel */}
        <div className="lg:col-span-6 space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {product.brandName && <span className="font-semibold uppercase tracking-wide text-[#1155EE]">{product.brandName}</span>}
              {product.brandName && <span aria-hidden="true">·</span>}
              <span className="font-mono-tabular">SKU: {activeSku}</span>
            </div>
            <h1 className="font-display mt-1.5 text-2xl font-extrabold text-[#0B1730] sm:text-3xl">
              {product.name}
            </h1>

            <div className="mt-2.5 flex items-center gap-3 text-sm">
              {reviewSummary.total > 0 ? (
                <div className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-bold text-[#0F1D3A]">{reviewSummary.average.toFixed(1)}</span>
                  <span className="text-slate-500">({reviewSummary.total} verified reviews)</span>
                </div>
              ) : (
                <span className="text-xs text-slate-500">No verified customer reviews yet</span>
              )}
              <span aria-hidden="true" className="text-slate-300">|</span>
              <span className={`text-xs font-semibold ${activeStock > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                {activeStock > 0 ? `In Stock (${activeStock} available)` : 'Out of Stock'}
              </span>
            </div>
          </div>

          {/* Pricing Block */}
          <div className="rounded-xl bg-[#F4F7FE] p-4">
            <div className="flex items-baseline gap-3">
              <span className="font-mono-tabular text-3xl font-extrabold text-[#1155EE]">
                {formatStoreCurrency(activePricing.currentPrice, currencyCfg)}
              </span>
              {activePricing.originalPrice && (
                <span className="font-mono-tabular text-base text-slate-400 line-through">
                  {formatStoreCurrency(activePricing.originalPrice, currencyCfg)}
                </span>
              )}
              {activePricing.isFlashSaleActive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                  <Zap className="h-3 w-3" /> Flash Sale Active
                </span>
              )}
            </div>
            {product.shortDescription && (
              <p className="mt-2 text-sm text-slate-600">{product.shortDescription}</p>
            )}
          </div>

          {/* Variant Selectors */}
          {product.hasVariants && product.variants && product.variants.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">Select Variant</p>
              <div className="flex flex-wrap gap-2">
                {product.variants
                  .filter((v) => v.isActive !== false)
                  .map((v) => {
                    const vStock = computeAvailableStock(v.stockOnHand, v.reservedStock);
                    const isSelected = selectedVariant?._id === v._id;
                    return (
                      <button
                        key={v._id}
                        type="button"
                        disabled={vStock <= 0}
                        onClick={() => {
                          setSelectedVariant(v);
                          setQuantity(1);
                        }}
                        className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${
                          isSelected
                            ? 'border-[#1155EE] bg-[#E9F0FD] text-[#1155EE]'
                            : vStock <= 0
                            ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 line-through'
                            : 'border-slate-300 bg-white text-[#0F1D3A] hover:border-[#1155EE]'
                        }`}
                      >
                        {v.title}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Quantity & CTAs */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-11 items-center rounded-xl border border-slate-300 bg-white">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                className="px-3 py-2 text-slate-600 hover:bg-slate-50"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="font-mono-tabular w-10 text-center text-sm font-bold">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(Math.max(1, activeStock), q + 1))}
                aria-label="Increase quantity"
                className="px-3 py-2 text-slate-600 hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              disabled={activeStock <= 0}
              onClick={() => handleAddOrBuy(false)}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1155EE] px-5 text-sm font-semibold text-white hover:bg-[#0B44CC] disabled:bg-slate-300"
            >
              <ShoppingCart className="h-4 w-4" />
              Add to Cart
            </button>

            <button
              type="button"
              disabled={activeStock <= 0}
              onClick={() => handleAddOrBuy(true)}
              className="flex h-11 items-center justify-center rounded-xl bg-[#0B1730] px-5 text-sm font-semibold text-white hover:bg-[#172B52] disabled:bg-slate-300"
            >
              Buy Now
            </button>

            <button
              type="button"
              onClick={handleWishlist}
              aria-label="Save to wishlist"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 hover:border-rose-300 hover:text-rose-600"
            >
              <Heart className="h-4 w-4" />
            </button>
          </div>

          {/* C. Bangladesh Delivery Charge Estimator */}
          <div className="rounded-xl border border-slate-200 p-4 text-xs">
            <div className="mb-2.5 flex items-center gap-2 font-semibold text-[#0F1D3A]">
              <Truck className="h-4 w-4 text-[#1155EE]" />
              <span>Delivery Estimator (Bangladesh)</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <select
                aria-label="Select division"
                value={estDivision}
                onChange={(e) => {
                  const nextDiv = e.target.value;
                  setEstDivision(nextDiv);
                  const dists = getDistrictsForDivision(nextDiv);
                  const firstDist = dists[0]?.name || '';
                  setEstDistrict(firstDist);
                  const upas = getUpazilasForDistrict(nextDiv, firstDist);
                  setEstUpazila(upas[0]?.name || '');
                }}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
              >
                {getDivisionNames().map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <select
                aria-label="Select district"
                value={estDistrict}
                onChange={(e) => {
                  const nextDist = e.target.value;
                  setEstDistrict(nextDist);
                  const upas = getUpazilasForDistrict(estDivision, nextDist);
                  setEstUpazila(upas[0]?.name || '');
                }}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
              >
                {getDistrictsForDivision(estDivision).map((dist) => (
                  <option key={dist.name} value={dist.name}>{dist.name}</option>
                ))}
              </select>
              <select
                aria-label="Select upazila"
                value={estUpazila}
                onChange={(e) => setEstUpazila(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
              >
                {getUpazilasForDistrict(estDivision, estDistrict).map((u) => (
                  <option key={u.name} value={u.name}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-slate-600">
              <span>
                Estimated Delivery: <strong className="text-[#0F1D3A]">{shippingEstimate.estimatedDays}</strong>
              </span>
              <span>
                Charge:{' '}
                <strong className="font-mono-tabular text-[#1155EE]">
                  {shippingEstimate.freeShippingApplied
                    ? `FREE${freeThreshold > 0 ? ` (Order ≥ ${formatStoreCurrency(freeThreshold, currencyCfg)})` : ''}`
                    : formatStoreCurrency(shippingEstimate.charge, currencyCfg)}
                </strong>
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-4 border-t border-slate-100 pt-2 text-slate-500">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />{' '}
                {settings?.paymentMethods?.codEnabled === false ? 'Prepaid Online Checkout' : 'Cash on Delivery Available'}
              </span>
              {product.warrantyInfo && (
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#1155EE]" /> {product.warrantyInfo}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <RotateCcw className="h-3.5 w-3.5 text-slate-500" /> {product.returnPolicyNote || '7 Days Easy Return'}
              </span>
            </div>
          </div>

          {productDetailAd && (
            <a
              href={productDetailAd.destinationUrl}
              onClick={() => {
                fetch(`/api/storefront/ads/${productDetailAd.id}/track`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ event: 'click' }),
                }).catch(() => undefined);
              }}
              className="block overflow-hidden rounded-xl border border-slate-200 bg-white transition-opacity hover:opacity-95"
            >
              <ResilientImage
                src={productDetailAd.imageUrl}
                alt={productDetailAd.altText || productDetailAd.title}
                className="max-h-28 w-full object-cover"
              />
            </a>
          )}
        </div>
      </div>

      {/* D. Product Information Tabs */}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {(
            [
              { id: 'description', label: 'Description & Features' },
              { id: 'specs', label: 'Specifications' },
              { id: 'shipping', label: 'Shipping & Warranty' },
              { id: 'faqs', label: 'FAQs' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                activeTab === t.id ? 'bg-[#1155EE] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="pt-5 text-sm leading-relaxed text-slate-700">
          {activeTab === 'description' && (
            <div className="space-y-4">
              <p className="whitespace-pre-line">{product.description}</p>
              {product.features && product.features.length > 0 && (
                <div>
                  <h3 className="font-display mb-2 text-base font-bold text-[#0F1D3A]">Key Highlights</h3>
                  <ul className="list-inside list-disc space-y-1 text-slate-600">
                    {product.features.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === 'specs' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {product.attributes &&
                Object.entries(product.attributes).map(([key, val]) => (
                  <div key={key} className="flex justify-between border-b border-slate-100 py-2">
                    <span className="font-semibold text-slate-600">{key}</span>
                    <span className="text-[#0F1D3A]">{val}</span>
                  </div>
                ))}
              {product.specifications?.map((spec, idx) => (
                <div key={idx} className="flex justify-between border-b border-slate-100 py-2">
                  <span className="font-semibold text-slate-600">{spec.label}</span>
                  <span className="text-[#0F1D3A]">{spec.value}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'shipping' && (
            <div className="space-y-2 text-slate-600">
              <p>
                <strong>Dhaka Metro:</strong> {formatStoreCurrency(settings?.shippingSettings?.dhakaMetroCharge ?? 60, currencyCfg)} (1–2 business days).
                {freeThreshold > 0 && ` Free on orders of ${formatStoreCurrency(freeThreshold, currencyCfg)}+.`}
              </p>
              <p>
                <strong>Dhaka Suburbs:</strong> {formatStoreCurrency(settings?.shippingSettings?.dhakaSuburbCharge ?? 90, currencyCfg)} (2–3 business days).
              </p>
              <p>
                <strong>Nationwide (64 Districts):</strong> {formatStoreCurrency(settings?.shippingSettings?.nationwideCharge ?? 120, currencyCfg)} (3–5 business days).
              </p>
              <p><strong>Warranty:</strong> {product.warrantyInfo || 'Standard brand warranty as stated.'}</p>
              <p><strong>Return Policy:</strong> {product.returnPolicyNote || '7-day replacement for eligible unopened/defective items.'}</p>
            </div>
          )}

          {activeTab === 'faqs' && (
            <div className="space-y-3">
              {product.faqs && product.faqs.length > 0 ? (
                product.faqs.map((faq, i) => (
                  <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <p className="font-semibold text-[#0F1D3A]">{faq.question}</p>
                    <p className="mt-1 text-slate-600">{faq.answer}</p>
                  </div>
                ))
              ) : (
                <p className="text-slate-500">No product-specific FAQs added yet. Contact our support team for questions.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* E. Customer Reviews & Histogram */}
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <h2 className="font-display text-xl font-bold text-[#0F1D3A]">Customer Reviews</h2>
          <select
            aria-label="Sort reviews"
            value={reviewSort}
            onChange={(e) => setReviewSort(e.target.value as 'newest' | 'highest' | 'lowest')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
          >
            <option value="newest">Newest First</option>
            <option value="highest">Highest Rating</option>
            <option value="lowest">Lowest Rating</option>
          </select>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="rounded-xl bg-[#F8FAFC] p-5">
              <div className="flex items-baseline gap-2">
                <span className="font-mono-tabular text-4xl font-extrabold text-[#0F1D3A]">
                  {reviewSummary.total > 0 ? reviewSummary.average.toFixed(1) : '0.0'}
                </span>
                <span className="text-sm text-slate-500">/ 5.0</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Based on {reviewSummary.total} approved review{reviewSummary.total === 1 ? '' : 's'}
              </p>

              <div className="mt-4 space-y-2">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = reviewSummary.histogram[star] || 0;
                  const pct = reviewSummary.total > 0 ? Math.round((count / reviewSummary.total) * 100) : 0;
                  return (
                    <div key={star} className="flex items-center gap-2 text-xs">
                      <span className="w-8 font-semibold text-slate-600">{star}★</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="font-mono-tabular w-8 text-right text-slate-500">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {canReview ? (
              <form onSubmit={handleReviewSubmit} className="mt-5 space-y-3 rounded-xl border border-slate-200 p-4">
                <h3 className="font-display text-sm font-bold text-[#0F1D3A]">Write a Verified Review</h3>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Rating</label>
                  <select
                    value={revRating}
                    onChange={(e) => setRevRating(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  >
                    {[5, 4, 3, 2, 1].map((r) => (
                      <option key={r} value={r}>{r} Stars</option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={revTitle}
                  onChange={(e) => setRevTitle(e.target.value)}
                  placeholder="Review headline"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
                <textarea
                  required
                  minLength={10}
                  rows={3}
                  value={revComment}
                  onChange={(e) => setRevComment(e.target.value)}
                  placeholder="Share your honest experience with this product..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="w-full rounded-lg bg-[#1155EE] py-2 text-xs font-semibold text-white hover:bg-[#0B44CC]"
                >
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </button>
              </form>
            ) : (
              <p className="mt-4 text-xs text-slate-500">
                Only customers with a delivered order for this item can submit a verified review.
              </p>
            )}
          </div>

          <div className="lg:col-span-8">
            {reviews.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                No approved reviews for this product yet.
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((rev) => (
                  <article key={rev._id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#0F1D3A]">{rev.userName}</span>
                        {rev.isVerifiedPurchase && (
                          <span className="text-[11px] font-semibold text-emerald-700">Verified Purchase</span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">
                        {new Date(rev.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-0.5 text-amber-400">
                      {Array.from({ length: rev.rating }).map((_, idx) => (
                        <Star key={idx} className="h-3.5 w-3.5 fill-amber-400" />
                      ))}
                    </div>
                    <h4 className="mt-2 text-sm font-semibold text-[#0F1D3A]">{rev.title}</h4>
                    <p className="mt-1 text-sm text-slate-600">{rev.comment}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* F. Related Products */}
      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display mb-4 text-xl font-bold text-[#0F1D3A]">Related Products</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
