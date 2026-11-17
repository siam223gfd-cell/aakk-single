import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  Flame,
  Heart,
  Home,
  LayoutGrid,
  LogOut,
  MapPin,
  Menu,
  Package,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Store,
  User,
  X,
} from 'lucide-react';
import { SearchBar } from '../../features/search/SearchBar';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { openCartDrawer, selectCartLineCount } from '../../features/cart/cartSlice';
import { logoutUser, openAuthModal } from '../../features/auth/authSlice';
import { isStaffRole } from '../../lib/rbac';
import type { CategoryItem, HomepageConfigData } from '../../types/commerce';

interface StoreHeaderProps {
  categories: CategoryItem[];
  announcement?: HomepageConfigData['announcementBar'];
  storeInfo?: HomepageConfigData['storeInfo'];
  headerSettings?: HomepageConfigData['headerSettings'];
  navigationMenu?: HomepageConfigData['navigationMenu'];
  currencySettings?: HomepageConfigData['currencySettings'];
}

export function StoreHeader({
  categories = [],
  announcement,
  storeInfo,
  headerSettings,
  navigationMenu,
  currencySettings,
}: StoreHeaderProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const cartLineCount = useAppSelector(selectCartLineCount);
  const { user } = useAppSelector((s) => s.auth);

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [catDropdownOpen, setCatDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const accountRef = useRef<HTMLDivElement>(null);
  const catRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
      if (catRef.current && !catRef.current.contains(e.target as Node)) {
        setCatDropdownOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAccountMenuOpen(false);
        setCatDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    window.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      window.removeEventListener('keydown', onEsc);
    };
  }, []);

  const safeCategories = Array.isArray(categories) ? categories : [];
  const topLevelCategories = safeCategories.filter((c) => !c.parentId);
  const announcementEnabled = announcement ? announcement.enabled : true;
  const announcementText = announcement?.text || 'Free Shipping on Orders Over ৳999';
  const showSearch = headerSettings?.showSearch !== false;
  const showWishlist = headerSettings?.showWishlist !== false;
  const showCategoryMenu = headerSettings?.showCategoryMenu !== false;
  const isStickyHeader = headerSettings?.stickyHeader !== false;
  const specialOfferLabel = headerSettings?.specialOfferLabel || 'Special Offer';
  const specialOfferUrl = headerSettings?.specialOfferUrl || '/offers';
  const activeNavLinks = (navigationMenu || [])
    .filter((item) => item.isActive !== false && item.label && item.url)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const brandTitle = storeInfo?.storeName ? storeInfo.storeName.split(' ')[0] : 'NOVARA';
  const currencyBadge = `BD · ${currencySettings?.symbol || '৳'} ${currencySettings?.code || 'BDT'}`;

  const handleProtectedNav = (dest: string) => {
    setAccountMenuOpen(false);
    if (!user) {
      dispatch(
        openAuthModal({
          tab: 'login',
          returnUrl: dest,
          notice: 'Please sign in to access your account.',
        }),
      );
      return;
    }
    navigate(dest);
  };

  return (
    <header className={`${isStickyHeader ? 'sticky top-0 z-40' : 'relative z-40'} w-full bg-white shadow-xs`}>
      {/* 1. Top Navy Announcement Bar */}
      {announcementEnabled && (
        <div className="bg-[#0B1730] text-white">
          <div className="mx-auto flex h-9 max-w-[1380px] items-center justify-between px-4 text-xs">
            <div className="flex items-center gap-2 truncate">
              <Flame className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span className="truncate font-medium">{announcementText}</span>
              {announcement?.linkText && announcement?.linkUrl && (
                <Link
                  to={announcement.linkUrl}
                  className="shrink-0 font-semibold text-blue-300 underline-offset-2 hover:text-white hover:underline"
                >
                  {announcement.linkText}
                </Link>
              )}
            </div>
            <nav aria-label="Utility links" className="hidden items-center gap-3 text-slate-200 sm:flex">
              <Link to="/track-order" className="hover:text-white whitespace-nowrap">
                Track Order
              </Link>
              <span aria-hidden="true" className="text-slate-600">|</span>
              <Link to="/pages/faqs" className="hover:text-white whitespace-nowrap">
                Help
              </Link>
              <span aria-hidden="true" className="text-slate-600">|</span>
              <Link to="/contact" className="hover:text-white whitespace-nowrap">
                Contact
              </Link>
              <span aria-hidden="true" className="text-slate-600">|</span>
              <span className="font-medium text-white whitespace-nowrap">{currencyBadge}</span>
            </nav>
          </div>
        </div>
      )}

      {/* 2. Main White Header */}
      <div className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-4 px-4 py-3">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="rounded-lg p-1.5 text-[#0F1D3A] hover:bg-slate-100 lg:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link to="/" className="flex items-center gap-2 whitespace-nowrap shrink-0">
              {storeInfo?.logoUrl ? (
                <img
                  src={storeInfo.logoUrl}
                  alt={storeInfo.storeName || brandTitle}
                  className="h-9 w-9 rounded-xl object-contain"
                />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1155EE] text-white shadow-xs">
                  <ShoppingBag className="h-5 w-5" />
                </span>
              )}
              <span className="font-display text-xl font-extrabold tracking-tight text-[#0F1D3A]">
                {brandTitle}
              </span>
            </Link>
          </div>

          {/* Search Bar (Desktop) */}
          {showSearch && (
            <div className="hidden flex-1 justify-center px-4 md:flex">
              <SearchBar />
            </div>
          )}

          {/* Right Circular Icons */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Account Icon + Accessible Popup */}
            <div ref={accountRef} className="relative">
              <button
                type="button"
                onClick={() => setAccountMenuOpen((o) => !o)}
                aria-label="Account menu"
                aria-expanded={accountMenuOpen}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0F1D3A] transition-colors hover:border-[#1155EE] hover:text-[#1155EE]"
              >
                <User className="h-4 w-4" />
              </button>

              {accountMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  {user ? (
                    <div className="border-b border-slate-100 px-3 py-2.5">
                      <p className="truncate text-sm font-bold text-[#0F1D3A]">{user.name}</p>
                      <p className="truncate text-xs text-slate-500">{user.email}</p>
                    </div>
                  ) : (
                    <div className="border-b border-slate-100 p-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          dispatch(openAuthModal({ tab: 'login' }));
                        }}
                        className="w-full rounded-xl bg-[#1155EE] py-2 text-xs font-semibold text-white hover:bg-[#0B44CC]"
                      >
                        Sign In / Register
                      </button>
                    </div>
                  )}

                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => handleProtectedNav('/account/orders')}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Package className="h-4 w-4 text-slate-400" />
                      My Orders
                    </button>
                    <button
                      type="button"
                      onClick={() => handleProtectedNav('/account/addresses')}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <MapPin className="h-4 w-4 text-slate-400" />
                      Saved Addresses
                    </button>
                    <button
                      type="button"
                      onClick={() => handleProtectedNav('/account')}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Settings className="h-4 w-4 text-slate-400" />
                      Profile & Settings
                    </button>
                    {user && isStaffRole(user.role) && (
                      <Link
                        to="/admin"
                        onClick={() => setAccountMenuOpen(false)}
                        className="mt-1 flex w-full items-center gap-2.5 rounded-xl bg-[#E9F0FD] px-3 py-2 text-sm font-semibold text-[#1155EE] hover:bg-blue-100"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Admin Operations
                      </Link>
                    )}
                    {user && (
                      <button
                        type="button"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          dispatch(logoutUser());
                        }}
                        className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Wishlist Icon */}
            {showWishlist && (
              <Link
                to="/wishlist"
                aria-label="Wishlist"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0F1D3A] transition-colors hover:border-[#1155EE] hover:text-[#1155EE]"
              >
                <Heart className="h-4 w-4" />
              </Link>
            )}

            {/* Cart Icon with Unique Line Count Badge */}
            <button
              type="button"
              onClick={() => dispatch(openCartDrawer())}
              aria-label={`Open cart with ${cartLineCount} items`}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0F1D3A] transition-colors hover:border-[#1155EE] hover:text-[#1155EE]"
            >
              <ShoppingCart className="h-4 w-4" />
              {cartLineCount > 0 && (
                <span className="font-mono-tabular absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                  {cartLineCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        {showSearch && (
          <div className="px-4 pb-3 md:hidden">
            <SearchBar />
          </div>
        )}
      </div>

      {/* 3. Category & Primary Navigation Row (Desktop) */}
      <div className="hidden border-b border-slate-200/80 bg-white lg:block">
        <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-6 px-4 py-2">
          <div className="flex items-center gap-6">
            {/* All Categories Royal Blue Dropdown Button */}
            {showCategoryMenu && (
              <div ref={catRef} className="relative">
                <button
                  type="button"
                  onClick={() => setCatDropdownOpen((v) => !v)}
                  aria-expanded={catDropdownOpen}
                  className="flex items-center gap-2 rounded-lg bg-[#1155EE] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0B44CC] whitespace-nowrap shrink-0"
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span>All Categories</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>

                {catDropdownOpen && (
                  <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                    <Link
                      to="/shop"
                      onClick={() => setCatDropdownOpen(false)}
                      className="block rounded-xl px-3 py-2 text-sm font-semibold text-[#1155EE] hover:bg-slate-50"
                    >
                      All Products
                    </Link>
                    {topLevelCategories.map((cat) => (
                      <Link
                        key={cat.id}
                        to={`/category/${cat.slug}`}
                        onClick={() => setCatDropdownOpen(false)}
                        className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-[#1155EE]"
                      >
                        <span>{cat.name}</span>
                        {cat.nameBn && <span className="text-[11px] text-slate-400">{cat.nameBn}</span>}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Clean Single-Line Nav Links */}
            <nav aria-label="Primary" className="flex items-center gap-6 text-[13px] font-medium text-[#0F1D3A]">
              {activeNavLinks.length > 0 ? (
                activeNavLinks.map((item, idx) =>
                  item.openInNewTab ? (
                    <a
                      key={`${item.url}-${idx}`}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-[#1155EE] whitespace-nowrap shrink-0"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      key={`${item.url}-${idx}`}
                      to={item.url}
                      className="hover:text-[#1155EE] whitespace-nowrap shrink-0"
                    >
                      {item.label}
                    </Link>
                  ),
                )
              ) : (
                <>
                  <Link to="/" className="flex items-center gap-1.5 hover:text-[#1155EE] whitespace-nowrap shrink-0">
                    <Home className="h-3.5 w-3.5 text-[#1155EE]" />
                    Home
                  </Link>
                  <Link to="/shop" className="flex items-center gap-1.5 hover:text-[#1155EE] whitespace-nowrap shrink-0">
                    <Store className="h-3.5 w-3.5 text-slate-500" />
                    Shop
                  </Link>
                  <Link to="/category/mobiles-tablets" className="hover:text-[#1155EE] whitespace-nowrap shrink-0">
                    Electronics
                  </Link>
                  <Link to="/category/fashion-lifestyle" className="hover:text-[#1155EE] whitespace-nowrap shrink-0">
                    Fashion
                  </Link>
                  <Link to="/category/home-appliances" className="hover:text-[#1155EE] whitespace-nowrap shrink-0">
                    Home &amp; Living
                  </Link>
                  <Link to="/category/books-education" className="hover:text-[#1155EE] whitespace-nowrap shrink-0">
                    Books
                  </Link>
                </>
              )}
            </nav>
          </div>

          <Link
            to={specialOfferUrl}
            className="flex items-center gap-1.5 rounded-full bg-[#0B1730] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#17284D] whitespace-nowrap shrink-0"
          >
            <span>{specialOfferLabel}</span>
            <Flame className="h-3.5 w-3.5 text-amber-400" />
          </Link>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="border-b border-slate-200 bg-white px-4 py-4 lg:hidden">
          <nav className="grid grid-cols-2 gap-2 text-sm font-medium text-[#0F1D3A]">
            <Link to="/" onClick={() => setMobileMenuOpen(false)} className="rounded-lg bg-slate-50 px-3 py-2">
              Home
            </Link>
            <Link to="/shop" onClick={() => setMobileMenuOpen(false)} className="rounded-lg bg-slate-50 px-3 py-2">
              All Products
            </Link>
            <Link to="/track-order" onClick={() => setMobileMenuOpen(false)} className="rounded-lg bg-slate-50 px-3 py-2">
              Track Order
            </Link>
            <Link to="/contact" onClick={() => setMobileMenuOpen(false)} className="rounded-lg bg-slate-50 px-3 py-2">
              Contact Support
            </Link>
            {activeNavLinks.map((item, idx) =>
              item.openInNewTab ? (
                <a
                  key={`mobile-${item.url}-${idx}`}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="truncate rounded-lg border border-blue-100 bg-[#F4F7FE] px-3 py-2 text-xs font-semibold text-[#1155EE]"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={`mobile-${item.url}-${idx}`}
                  to={item.url}
                  onClick={() => setMobileMenuOpen(false)}
                  className="truncate rounded-lg border border-blue-100 bg-[#F4F7FE] px-3 py-2 text-xs font-semibold text-[#1155EE]"
                >
                  {item.label}
                </Link>
              ),
            )}
            {topLevelCategories.slice(0, 8).map((cat) => (
              <Link
                key={cat.id}
                to={`/category/${cat.slug}`}
                onClick={() => setMobileMenuOpen(false)}
                className="truncate rounded-lg border border-slate-100 px-3 py-2 text-xs text-slate-700"
              >
                {cat.name}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
