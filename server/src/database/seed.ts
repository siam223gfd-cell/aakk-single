import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { connectToMongoAtlas, isDatabaseReady } from './connection';
import { UserModel, CustomerGroupModel } from '../modules/users/user.model';
import { CategoryModel, BrandModel } from '../modules/categories/category.model';
import { ProductModel } from '../modules/products/product.model';
import { HomepageConfigModel, CmsPageModel, FaqModel, BlogPostModel, ProductAttributePresetModel } from '../modules/cms/cms.model';
import { CouponModel, DiscountRuleModel, PromotionalCampaignModel } from '../modules/coupons/coupon.model';
import { HeroSlideModel } from '../modules/hero-slides/heroSlide.model';
import { BannerModel } from '../modules/banners/banner.model';
import { DEFAULT_SERVER_HOMEPAGE_SECTIONS, HomepageLayoutModel } from '../modules/cms/homepageLayout.model';

export async function runDatabaseSeed(): Promise<{ seeded: boolean; reason?: string }> {
  if (!isDatabaseReady()) {
    return { seeded: false, reason: 'MongoDB Atlas is not connected.' };
  }

  // 1. Optional Super Admin bootstrap from env vars only (never hardcoded passwords)
  if (env.INITIAL_SUPER_ADMIN_EMAIL && env.INITIAL_SUPER_ADMIN_PASSWORD) {
    const existingAdmin = await UserModel.findOne({ email: env.INITIAL_SUPER_ADMIN_EMAIL.toLowerCase() });
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(env.INITIAL_SUPER_ADMIN_PASSWORD, 12);
      await UserModel.create({
        name: env.INITIAL_SUPER_ADMIN_NAME || 'NOVARA Super Admin',
        email: env.INITIAL_SUPER_ADMIN_EMAIL.toLowerCase(),
        passwordHash,
        role: 'super_admin',
        isVerified: true,
        status: 'active',
      });
      console.info(`[NOVARA SEED] Bootstrapped Super Admin: ${env.INITIAL_SUPER_ADMIN_EMAIL}`);
    }
  }

  // 2. Homepage CMS Config
  const existingConfig = await HomepageConfigModel.findOne({ key: 'main' });
  if (!existingConfig) {
    await HomepageConfigModel.create({
      key: 'main',
      announcementBar: {
        enabled: true,
        text: 'Free Shipping on Orders Over ৳999',
        linkText: 'Shop Now',
        linkUrl: '/shop',
      },
      heroSlides: [
        {
          badgeText: 'Up to 50% OFF',
          headlineLine1: 'Smart Technology',
          headlineLine2: 'Better Life',
          subtitle: 'Discover the latest gadgets and upgrade your lifestyle with NOVARA.',
          ctaLabel: 'Shop Now',
          ctaUrl: '/shop',
          imageUrl: '/src/assets/images/hero_smart_tech_1794832024388.jpg',
          isActive: true,
        },
        {
          badgeText: 'New Arrivals 2026',
          headlineLine1: 'Curated Essentials',
          headlineLine2: 'Across Bangladesh',
          subtitle: 'Genuine electronics, fashion, books, and home living delivered nationwide.',
          ctaLabel: 'Explore Store',
          ctaUrl: '/shop',
          imageUrl: '/src/assets/images/hero_smart_tech_1794832024388.jpg',
          isActive: true,
        },
      ],
      promoBentoCards: [
        {
          eyebrow: 'Big Sale',
          title: 'UP TO 70% OFF',
          subtitle: "Don't Miss Out!",
          ctaLabel: 'Shop Now',
          ctaUrl: '/shop?discount=true',
          imageUrl: '/src/assets/images/promo_headphones_1794832024152.jpg',
          theme: 'royal-blue',
        },
        {
          eyebrow: 'New Arrivals',
          title: 'Explore the Latest Trends',
          subtitle: 'Fashion · Tech · Lifestyle',
          ctaLabel: 'Shop Now',
          ctaUrl: '/shop?sort=newest',
          imageUrl: '/src/assets/images/promo_sneakers_1794832025309.jpg',
          theme: 'ice-blue',
        },
        {
          eyebrow: 'Premium Quality',
          title: 'Smart Devices',
          subtitle: 'Innovate Your Life',
          ctaLabel: 'Shop Now',
          ctaUrl: '/category/smart-watches',
          imageUrl: '/src/assets/images/promo_smartwatch_1794832026084.jpg',
          theme: 'midnight-navy',
        },
      ],
      featureBanners: {
        giftBanner: {
          enabled: true,
          title: 'Special Gift',
          subtitle: 'For Our Valued Customers',
          description: 'Get a Free Gift on Orders Over ৳5,000',
          ctaLabel: 'Shop Now',
          ctaUrl: '/shop',
        },
        trustBanner: {
          enabled: true,
          title: 'Premium Quality Guaranteed',
          subtitle: 'Shop with Confidence',
          bullets: ['Easy Returns', 'Secure Payment', 'Trusted Store'],
        },
      },
      contactInfo: {
        email: 'support@novara.com.bd',
        address: 'Dhaka, Bangladesh',
      },
    });
  }

  // 2b. Standalone Hero Slides (if empty)
  const heroSlideCount = await HeroSlideModel.countDocuments();
  if (heroSlideCount === 0) {
    await HeroSlideModel.insertMany([
      {
        badgeText: 'Up to 50% OFF',
        heading: 'Smart Technology',
        headlineLine2: 'Better Life',
        subtitle: 'Discover the latest gadgets and upgrade your lifestyle with NOVARA.',
        desktopImageUrl: '/src/assets/images/hero_smart_tech_1794832024388.jpg',
        mobileImageUrl: '/src/assets/images/hero_smart_tech_1794832024388.jpg',
        ctaText: 'Shop Now',
        ctaUrl: '/shop',
        sortOrder: 0,
        isActive: true,
      },
      {
        badgeText: 'New Arrivals 2026',
        heading: 'Curated Essentials',
        headlineLine2: 'Across Bangladesh',
        subtitle: 'Genuine electronics, fashion, books, and home living delivered nationwide.',
        desktopImageUrl: '/src/assets/images/hero_smart_tech_1794832024388.jpg',
        mobileImageUrl: '/src/assets/images/hero_smart_tech_1794832024388.jpg',
        ctaText: 'Explore Store',
        ctaUrl: '/shop',
        sortOrder: 1,
        isActive: true,
      },
    ]);
  }

  // 2c. Standalone Banners (if empty)
  const bannerCount = await BannerModel.countDocuments();
  if (bannerCount === 0) {
    await BannerModel.insertMany([
      {
        name: 'Hero Bento: Up to 70% Off',
        eyebrow: 'Big Sale',
        title: 'UP TO 70% OFF',
        subtitle: "Don't Miss Out!",
        desktopImageUrl: '/src/assets/images/promo_headphones_1794832024152.jpg',
        placement: 'hero_bento',
        theme: 'royal-blue',
        ctaText: 'Shop Now',
        destinationUrl: '/shop?discount=true',
        displayOrder: 1,
        priority: 30,
        status: 'published',
        isPublished: true,
      },
      {
        name: 'Hero Bento: Latest Trends',
        eyebrow: 'New Arrivals',
        title: 'Explore the Latest Trends',
        subtitle: 'Fashion · Tech · Lifestyle',
        desktopImageUrl: '/src/assets/images/promo_sneakers_1794832025309.jpg',
        placement: 'hero_bento',
        theme: 'ice-blue',
        ctaText: 'Shop Now',
        destinationUrl: '/shop?sort=newest',
        displayOrder: 2,
        priority: 20,
        status: 'published',
        isPublished: true,
      },
      {
        name: 'Hero Bento: Smart Devices',
        eyebrow: 'Premium Quality',
        title: 'Smart Devices',
        subtitle: 'Innovate Your Life',
        desktopImageUrl: '/src/assets/images/promo_smartwatch_1794832026084.jpg',
        placement: 'hero_bento',
        theme: 'midnight-navy',
        ctaText: 'Shop Now',
        destinationUrl: '/category/smart-watches',
        displayOrder: 3,
        priority: 10,
        status: 'published',
        isPublished: true,
      },
    ]);
  }

  // 2d. Dynamic Homepage Layout (if empty)
  const layoutExists = await HomepageLayoutModel.exists({ key: 'main' });
  if (!layoutExists) {
    await HomepageLayoutModel.create({
      key: 'main',
      name: 'Main Storefront Homepage',
      pageType: 'homepage',
      layoutVersion: 1,
      status: 'published',
      publishedAt: new Date(),
      draftSections: DEFAULT_SERVER_HOMEPAGE_SECTIONS,
      publishedSections: DEFAULT_SERVER_HOMEPAGE_SECTIONS,
    });
  }

  // 3. Categories
  const categoryCount = await CategoryModel.countDocuments();
  if (categoryCount === 0) {
    const categories = await CategoryModel.insertMany([
      { name: 'Mobiles & Tablets', nameBn: 'মোবাইল ও ট্যাবলেট', slug: 'mobiles-tablets', iconName: 'Smartphone', attributeSchemaType: 'electronics', sortOrder: 1 },
      { name: 'Laptops & Computers', nameBn: 'ল্যাপটপ ও কম্পিউটার', slug: 'laptops-computers', iconName: 'Laptop', attributeSchemaType: 'electronics', sortOrder: 2 },
      { name: 'Audio & Headphones', nameBn: 'অডিও ও হেডফোন', slug: 'audio-headphones', iconName: 'Headphones', attributeSchemaType: 'electronics', sortOrder: 3 },
      { name: 'Smart Watches', nameBn: 'স্মার্ট ওয়াচ ও ঘড়ি', slug: 'smart-watches', iconName: 'Watch', attributeSchemaType: 'electronics', sortOrder: 4 },
      { name: 'Cameras & Drones', nameBn: 'ক্যামেরা ও ড্রোন', slug: 'cameras-drones', iconName: 'Camera', attributeSchemaType: 'electronics', sortOrder: 5 },
      { name: 'Gaming & Consoles', nameBn: 'গেমিং ও কনসোল', slug: 'gaming-consoles', iconName: 'Gamepad2', attributeSchemaType: 'electronics', sortOrder: 6 },
      { name: 'Home Appliances', nameBn: 'হোম অ্যাপ্লায়েন্স', slug: 'home-appliances', iconName: 'Home', attributeSchemaType: 'home', sortOrder: 7 },
      { name: 'Fashion & Lifestyle', nameBn: 'ফ্যাশন ও লাইফস্টাইল', slug: 'fashion-lifestyle', iconName: 'Shirt', attributeSchemaType: 'general', sortOrder: 8 },
      { name: 'Bags & Wallets', nameBn: 'ব্যাগ ও ওয়ালেট', slug: 'bags-wallets', iconName: 'ShoppingBag', attributeSchemaType: 'general', sortOrder: 9 },
      { name: 'Shoes & Footwear', nameBn: 'জুতা ও ফুটওয়্যার', slug: 'shoes-footwear', iconName: 'Footprints', attributeSchemaType: 'general', sortOrder: 10 },
      { name: 'Books & Education', nameBn: 'বই ও শিক্ষা', slug: 'books-education', iconName: 'BookOpen', attributeSchemaType: 'books', sortOrder: 11 },
      { name: 'Beauty & Personal Care', nameBn: 'বিউটি ও স্কিনকেয়ার', slug: 'beauty-personal-care', iconName: 'Sparkles', attributeSchemaType: 'beauty', sortOrder: 12 },
    ]);

    const catMap = new Map(categories.map((c) => [c.slug, c]));

    const brands = await BrandModel.insertMany([
      { name: 'Samsung', slug: 'samsung', description: 'Flagship mobile and display electronics' },
      { name: 'Apple', slug: 'apple', description: 'Computers, audio, and wearables' },
      { name: 'Sony', slug: 'sony', description: 'Reference noise-canceling audio hardware' },
      { name: 'Nike', slug: 'nike', description: 'Performance footwear and lifestyle apparel' },
      { name: 'The North Face', slug: 'the-north-face', description: 'Technical packs and outdoor carry' },
      { name: 'Anker', slug: 'anker', description: 'Charging and power delivery accessories' },
      { name: 'Penguin Books', slug: 'penguin-books', description: 'International literature and motivational books' },
      { name: 'Novara Essentials', slug: 'novara-essentials', description: 'Curated house collection' },
    ]);
    const brandMap = new Map(brands.map((b) => [b.slug, b]));

    await ProductModel.insertMany([
      {
        name: 'Samsung Galaxy S25 Ultra',
        nameBn: 'স্যামসাং গ্যালাক্সি এস২৫ আল্ট্রা স্মার্টফোন',
        slug: 'samsung-galaxy-s25-ultra',
        sku: 'NVR-MOB-S25U',
        brandId: brandMap.get('samsung')!._id,
        brandName: 'Samsung',
        categoryId: catMap.get('mobiles-tablets')!._id,
        categoryPath: ['mobiles-tablets'],
        description: 'Titanium chassis flagship smartphone with integrated S Pen, 200MP pro-grade camera array, and 120Hz Dynamic AMOLED 2X display.',
        shortDescription: '6.9-inch Dynamic AMOLED 2X, 200MP Camera, Snapdragon Elite',
        features: ['200MP ProVisual Engine Camera', 'Integrated Titanium S Pen', '5000mAh Fast Charging Battery'],
        attributeGroup: 'electronics',
        attributes: { Brand: 'Samsung', Model: 'Galaxy S25 Ultra', Warranty: '1 Year Official', Compatibility: '5G Dual SIM' },
        specifications: [
          { label: 'Display', value: '6.9" QHD+ Dynamic AMOLED 2X 120Hz' },
          { label: 'Battery', value: '5000 mAh, 45W Fast Charge' },
          { label: 'Connectivity', value: '5G, Wi-Fi 7, Bluetooth 5.4' },
        ],
        bilingualKeywords: ['স্মার্টফোন', 'মোবাইল', 'ফোন', 'samsung', 'galaxy', 'smartphone'],
        basePrice: 128999,
        salePrice: 89999,
        stockOnHand: 28,
        hasVariants: true,
        variants: [
          { sku: 'NVR-MOB-S25U-256-TI', title: '256GB / Titanium Blue', options: { Storage: '256GB', Color: 'Titanium Blue' }, price: 128999, salePrice: 89999, stockOnHand: 16, reservedStock: 0, lowStockThreshold: 4, isActive: true },
          { sku: 'NVR-MOB-S25U-512-BK', title: '512GB / Titanium Black', options: { Storage: '512GB', Color: 'Titanium Black' }, price: 144999, salePrice: 104999, stockOnHand: 12, reservedStock: 0, lowStockThreshold: 4, isActive: true },
        ],
        images: [{ url: '/src/assets/images/product_smartphone_1794832025637.jpg', alt: 'Samsung Galaxy S25 Ultra', sortOrder: 0 }],
        warrantyInfo: '1 Year Official Service Warranty in Bangladesh',
        returnPolicyNote: '7 Days Easy Replacement for Manufacturing Defects',
        status: 'published',
        isFeatured: true,
        isNewArrival: true,
        isPremiumCollection: true,
        soldCount: 42,
      },
      {
        name: 'MacBook Air M4 13"',
        nameBn: 'ম্যাকবুক এয়ার এম৪ ১৩ ইঞ্চি ল্যাপটপ',
        slug: 'macbook-air-m4-13',
        sku: 'NVR-LAP-MBA4',
        brandId: brandMap.get('apple')!._id,
        brandName: 'Apple',
        categoryId: catMap.get('laptops-computers')!._id,
        categoryPath: ['laptops-computers'],
        description: 'Fanless aluminum ultrabook powered by next-gen silicon with Liquid Retina display and up to 18 hours battery endurance.',
        shortDescription: '13.6" Liquid Retina, 16GB Unified Memory, 512GB SSD',
        features: ['18-Hour All-Day Battery', 'MagSafe 3 & Dual Thunderbolt', '1080p FaceTime HD Camera'],
        attributeGroup: 'electronics',
        attributes: { Brand: 'Apple', Model: 'MacBook Air 13 M4', Storage: '512GB SSD', Warranty: '1 Year International' },
        specifications: [
          { label: 'Display', value: '13.6" Liquid Retina IPS' },
          { label: 'Memory', value: '16GB Unified RAM' },
          { label: 'Weight', value: '1.24 kg' },
        ],
        bilingualKeywords: ['ল্যাপটপ', 'কম্পিউটার', 'ম্যাকবুক', 'laptop', 'macbook', 'ultrabook'],
        basePrice: 149999,
        salePrice: 119999,
        stockOnHand: 15,
        hasVariants: true,
        variants: [
          { sku: 'NVR-LAP-MBA4-256-SL', title: '16GB / 256GB Silver', options: { Storage: '256GB', Color: 'Silver' }, price: 139999, salePrice: 112999, stockOnHand: 8, reservedStock: 0, lowStockThreshold: 3, isActive: true },
          { sku: 'NVR-LAP-MBA4-512-MD', title: '16GB / 512GB Midnight', options: { Storage: '512GB', Color: 'Midnight' }, price: 149999, salePrice: 119999, stockOnHand: 7, reservedStock: 0, lowStockThreshold: 3, isActive: true },
        ],
        images: [{ url: '/src/assets/images/product_laptop_1794832026646.jpg', alt: 'MacBook Air M4 13', sortOrder: 0 }],
        warrantyInfo: '1 Year Official International Warranty',
        returnPolicyNote: 'Sealed Box Return Eligible Within 7 Days',
        status: 'published',
        isFeatured: true,
        isNewArrival: true,
        isPremiumCollection: true,
        soldCount: 29,
      },
      {
        name: 'Sony WH-1000XM5 Wireless Headphones',
        nameBn: 'সনি ডব্লিউএইচ-১০০০এক্সএম৫ ওয়্যারলেস হেডফোন',
        slug: 'sony-wh-1000xm5',
        sku: 'NVR-AUD-XM5',
        brandId: brandMap.get('sony')!._id,
        brandName: 'Sony',
        categoryId: catMap.get('audio-headphones')!._id,
        categoryPath: ['audio-headphones'],
        description: 'Industry-leading Active Noise Cancellation with 8 microphones, crystal-clear hands-free calling, and 30-hour battery life.',
        shortDescription: 'Multi-microphone ANC, Multipoint Bluetooth, 30h Battery',
        features: ['8-Mic Auto NC Optimizer', '30 Hours Playback with Quick Charge', 'Ultra-lightweight soft-fit leather'],
        attributeGroup: 'electronics',
        attributes: { Brand: 'Sony', Model: 'WH-1000XM5', Connectivity: 'Bluetooth 5.2 / 3.5mm', Warranty: '1 Year Brand Warranty' },
        specifications: [
          { label: 'Driver Unit', value: '30mm Carbon Fiber Composite' },
          { label: 'Battery Life', value: 'Up to 30 hours (NC ON)' },
        ],
        bilingualKeywords: ['হেডফোন', 'অডিও', 'ইয়ারফোন', 'headphones', 'sony', 'anc', 'wireless'],
        basePrice: 48999,
        salePrice: 34999,
        stockOnHand: 34,
        hasVariants: false,
        variants: [],
        images: [{ url: '/src/assets/images/promo_headphones_1794832024152.jpg', alt: 'Sony WH-1000XM5', sortOrder: 0 }],
        warrantyInfo: '1 Year Official Warranty',
        returnPolicyNote: '7 Days Replacement Guarantee',
        status: 'published',
        isFeatured: true,
        isPremiumCollection: true,
        soldCount: 54,
      },
      {
        name: 'Apple Watch Series 10',
        nameBn: 'অ্যাপল ওয়াচ সিরিজ ১০ স্মার্টওয়াচ',
        slug: 'apple-watch-series-10',
        sku: 'NVR-WTC-AW10',
        brandId: brandMap.get('apple')!._id,
        brandName: 'Apple',
        categoryId: catMap.get('smart-watches')!._id,
        categoryPath: ['smart-watches'],
        description: 'Thinnest Apple Watch ever with wide-angle OLED Always-On Retina display, sleep apnea notifications, and fast charging.',
        shortDescription: '46mm Aluminum Case, Always-On OLED, Water Resistant 50m',
        features: ['Wide-Angle OLED Display', 'ECG & Blood Oxygen Sensors', '50m Swimproof Design'],
        attributeGroup: 'electronics',
        attributes: { Brand: 'Apple', Model: 'Series 10', Color: 'Jet Black', Warranty: '1 Year Apple Warranty' },
        bilingualKeywords: ['স্মার্টওয়াচ', 'ঘড়ি', 'ওয়াচ', 'smartwatch', 'apple watch'],
        basePrice: 64999,
        salePrice: 49999,
        stockOnHand: 22,
        hasVariants: false,
        variants: [],
        images: [{ url: '/src/assets/images/promo_smartwatch_1794832026084.jpg', alt: 'Apple Watch Series 10', sortOrder: 0 }],
        warrantyInfo: '1 Year International Warranty',
        status: 'published',
        isFeatured: true,
        isPremiumCollection: true,
        soldCount: 38,
      },
      {
        name: 'Nike Air Force 1 Low',
        nameBn: 'নাইকি এয়ার ফোর্স ১ লো স্নিকার্স জুতা',
        slug: 'nike-air-force-1-low',
        sku: 'NVR-SHU-AF1',
        brandId: brandMap.get('nike')!._id,
        brandName: 'Nike',
        categoryId: catMap.get('shoes-footwear')!._id,
        categoryPath: ['shoes-footwear'],
        description: 'Classic crisp leather court silhouette with encapsulated Nike Air cushioning and durable non-marking rubber outsole.',
        shortDescription: 'Full-grain leather upper, Nike Air sole unit',
        features: ['Stitched Leather Overlays', 'Padded Low-Cut Collar', 'Perforated Toe Box'],
        attributeGroup: 'general',
        attributes: { Material: 'Full-grain Leather', Color: 'White / Navy' },
        bilingualKeywords: ['জুতা', 'স্নিকার', 'পাদুকা', 'shoes', 'sneakers', 'nike'],
        basePrice: 15600,
        salePrice: 11999,
        stockOnHand: 40,
        hasVariants: true,
        variants: [
          { sku: 'NVR-SHU-AF1-41', title: 'EU 41 / White-Navy', options: { Size: 'EU 41', Color: 'White/Navy' }, price: 15600, salePrice: 11999, stockOnHand: 15, reservedStock: 0, lowStockThreshold: 3, isActive: true },
          { sku: 'NVR-SHU-AF1-42', title: 'EU 42 / White-Navy', options: { Size: 'EU 42', Color: 'White/Navy' }, price: 15600, salePrice: 11999, stockOnHand: 15, reservedStock: 0, lowStockThreshold: 3, isActive: true },
          { sku: 'NVR-SHU-AF1-43', title: 'EU 43 / White-Navy', options: { Size: 'EU 43', Color: 'White/Navy' }, price: 15600, salePrice: 11999, stockOnHand: 10, reservedStock: 0, lowStockThreshold: 3, isActive: true },
        ],
        images: [{ url: '/src/assets/images/promo_sneakers_1794832025309.jpg', alt: 'Nike Air Force 1', sortOrder: 0 }],
        status: 'published',
        isFeatured: true,
        isNewArrival: true,
        isPremiumCollection: true,
        soldCount: 47,
      },
      {
        name: 'The North Face Borealis Backpack',
        nameBn: 'দ্য নর্থ ফেস ব্যাকপ্যাক ট্রাভেল ব্যাগ',
        slug: 'the-north-face-backpack',
        sku: 'NVR-BAG-TNFB',
        brandId: brandMap.get('the-north-face')!._id,
        brandName: 'The North Face',
        categoryId: catMap.get('bags-wallets')!._id,
        categoryPath: ['bags-wallets'],
        description: '28-liter commuter backpack featuring FlexVent suspension system, padded 16-inch laptop sleeve, and water-repellent ripstop nylon.',
        shortDescription: '28L capacity, Padded 16" laptop compartment, Water-repellent',
        features: ['FlexVent Ergonomic Straps', 'Dedicated 16" Laptop Compartment', 'Dual External Bottle Pockets'],
        attributeGroup: 'home',
        attributes: { Material: '210D Recycled Nylon Ripstop', Color: 'Matte Black', Weight: '1.05 kg' },
        bilingualKeywords: ['ব্যাগ', 'ব্যাকপ্যাক', 'backpack', 'bag', 'laptop bag'],
        basePrice: 10500,
        salePrice: 7999,
        stockOnHand: 36,
        hasVariants: false,
        variants: [],
        images: [{ url: '/src/assets/images/product_backpack_1794832026092.jpg', alt: 'The North Face Backpack', sortOrder: 0 }],
        status: 'published',
        isFeatured: true,
        isPremiumCollection: true,
        soldCount: 31,
      },
      {
        name: 'Heavyweight Oversized Cotton Hoodie',
        nameBn: 'ওভারসাইজড কটন হুডি পোশাক',
        slug: 'oversized-cotton-hoodie',
        sku: 'NVR-FSH-HD01',
        brandId: brandMap.get('novara-essentials')!._id,
        brandName: 'Novara Essentials',
        categoryId: catMap.get('fashion-lifestyle')!._id,
        categoryPath: ['fashion-lifestyle'],
        description: '420 GSM combed organic cotton fleece hoodie tailored with drop shoulders, double-lined hood, and ribbed cuffs.',
        shortDescription: '420 GSM Heavyweight Cotton, Charcoal Black',
        features: ['420 GSM Ring-Spun Cotton', 'Double-Lined Structured Hood', 'Pre-Shrunk Enzyme Wash'],
        attributeGroup: 'general',
        attributes: { Material: '100% Combed Cotton', Color: 'Charcoal Black' },
        bilingualKeywords: ['হুডি', 'পোশাক', 'ফ্যাশন', 'জামা', 'hoodie', 'fashion', 'apparel'],
        basePrice: 2299,
        salePrice: 1499,
        stockOnHand: 75,
        hasVariants: true,
        variants: [
          { sku: 'NVR-FSH-HD01-M', title: 'Size M / Charcoal Black', options: { Size: 'M', Color: 'Charcoal Black' }, price: 2299, salePrice: 1499, stockOnHand: 25, reservedStock: 0, lowStockThreshold: 5, isActive: true },
          { sku: 'NVR-FSH-HD01-L', title: 'Size L / Charcoal Black', options: { Size: 'L', Color: 'Charcoal Black' }, price: 2299, salePrice: 1499, stockOnHand: 30, reservedStock: 0, lowStockThreshold: 5, isActive: true },
          { sku: 'NVR-FSH-HD01-XL', title: 'Size XL / Charcoal Black', options: { Size: 'XL', Color: 'Charcoal Black' }, price: 2299, salePrice: 1499, stockOnHand: 20, reservedStock: 0, lowStockThreshold: 5, isActive: true },
        ],
        images: [{ url: '/src/assets/images/product_hoodie_1794832027034.jpg', alt: 'Heavyweight Oversized Hoodie', sortOrder: 0 }],
        status: 'published',
        isNewArrival: true,
        isPremiumCollection: true,
        soldCount: 64,
      },
      {
        name: 'Atomic Habits — Motivational Books Edition',
        nameBn: 'অ্যাটমিক হ্যাবিটস — মোটিভেশনাল বই ও আত্মউন্নয়ন',
        slug: 'atomic-habits-motivational-book',
        sku: 'NVR-BK-ATMH',
        brandId: brandMap.get('penguin-books')!._id,
        brandName: 'Penguin Books',
        categoryId: catMap.get('books-education')!._id,
        categoryPath: ['books-education'],
        description: 'An easy and proven way to build good habits and break bad ones. Essential motivational self-help guide by James Clear.',
        shortDescription: 'Paperback Edition · English · Motivational Books',
        features: ['Original International Paperback', '320 Pages Acid-Free Paper', 'Includes Habit Scorecard Guide'],
        attributeGroup: 'books',
        attributes: {
          Author: 'James Clear',
          ISBN: '9781847941831',
          Publisher: 'Penguin Random House',
          Edition: 'International Paperback',
          Language: 'English',
          Format: 'Paperback',
          'Publication Year': '2024',
        },
        bilingualKeywords: ['মোটিভেশনাল বই', 'মোটিভেশনাল', 'বই', 'আত্মউন্নয়ন', 'motivational books', 'self help', 'book'],
        basePrice: 850,
        salePrice: 650,
        stockOnHand: 120,
        hasVariants: false,
        variants: [],
        images: [{ url: '/src/assets/images/product_backpack_1794832026092.jpg', alt: 'Atomic Habits Motivational Book', sortOrder: 0 }],
        status: 'published',
        isFeatured: false,
        isNewArrival: true,
        isPremiumCollection: true,
        soldCount: 88,
      },
    ]);
  }

  // 4. Default Coupon
  const couponCount = await CouponModel.countDocuments();
  if (couponCount === 0) {
    await CouponModel.create({
      code: 'NOVARA10',
      description: '10% off orders over ৳1,500 (max ৳500 discount)',
      discountType: 'percentage',
      discountValue: 10,
      maxDiscountAmount: 500,
      minOrderAmount: 1500,
      isActive: true,
      perCustomerLimit: 2,
    });
  }

  // 5. Default CMS Policy / Info Pages
  const pageCount = await CmsPageModel.countDocuments();
  if (pageCount === 0) {
    await CmsPageModel.insertMany([
      {
        slug: 'about-us',
        title: 'About NOVARA COMMERCE',
        content:
          'NOVARA COMMERCE is a single-vendor retail store operating across Bangladesh, offering verified electronics, lifestyle apparel, books, and home essentials directly from official distribution channels with nationwide courier delivery.',
        isPublished: true,
      },
      {
        slug: 'shipping-info',
        title: 'Shipping & Delivery Information',
        content:
          'Orders inside Dhaka Metro are delivered within 1-2 business days (৳60). Dhaka Suburbs (Savar, Gazipur, Narayanganj) take 2-3 business days (৳90). Nationwide delivery across all 64 districts takes 3-5 business days (৳120). Orders of ৳999 or above qualify for Free Standard Shipping.',
        isPublished: true,
      },
      {
        slug: 'return-policy',
        title: 'Returns & Replacement Policy',
        content:
          'Eligible items may be requested for return within 7 days of delivery if unused, in original packaging, and accompanied by the NOVARA invoice. Returned stock is physically inspected before restocking or refund processing.',
        isPublished: true,
      },
      {
        slug: 'faqs',
        title: 'Frequently Asked Questions',
        content:
          'Q: Do you offer Cash on Delivery? A: Yes, Cash on Delivery is available across Bangladesh.\nQ: Are electronics covered by warranty? A: All electronics list their official service warranty clearly on the product page.',
        isPublished: true,
      },
      {
        slug: 'privacy-policy',
        title: 'Privacy Policy',
        content:
          'NOVARA COMMERCE collects only the personal information required to authenticate your account, fulfill orders, and provide support. Marketing emails require explicit opt-in consent.',
        isPublished: true,
      },
      {
        slug: 'terms',
        title: 'Terms & Conditions',
        content:
          'All prices are listed in Bangladeshi Taka (৳ / BDT). Order confirmation is subject to server-side inventory verification and payment validation.',
        isPublished: true,
      },
    ]);
  }

  // 6. Default FAQs
  const faqCount = await FaqModel.countDocuments();
  if (faqCount === 0) {
    await FaqModel.insertMany([
      {
        question: 'How fast is delivery across Bangladesh?',
        answer: 'Inside Dhaka Metro delivery takes 24–48 hours. Dhaka Suburbs take 2–3 days, and nationwide 64-district delivery arrives in 3–5 business days.',
        category: 'Shipping & Delivery',
        sortOrder: 1,
        isPublished: true,
      },
      {
        question: 'Do you support Cash on Delivery (COD)?',
        answer: 'Yes! Cash on Delivery is available across all 64 districts of Bangladesh alongside bKash, Visa/Mastercard, and SSLCommerz online payment.',
        category: 'Payments',
        sortOrder: 2,
        isPublished: true,
      },
      {
        question: 'How does the 7-day return and replacement policy work?',
        answer: 'Unused items in original sealed packaging with invoice can be returned within 7 days of delivery from your My Orders dashboard.',
        category: 'Returns & Warranty',
        sortOrder: 3,
        isPublished: true,
      },
    ]);
  }

  // 7. Default Blog Posts
  const blogCount = await BlogPostModel.countDocuments();
  if (blogCount === 0) {
    await BlogPostModel.insertMany([
      {
        title: 'How to Choose the Right Ultrabook in Bangladesh (2026 Buyer Guide)',
        slug: 'choose-right-ultrabook-bangladesh-2026',
        excerpt: 'Battery endurance, unified memory, display accuracy, and local service warranty tips for professionals and students.',
        content: 'When comparing ultrabooks in Bangladesh, look beyond raw clock speed. Prioritize all-day battery life, official warranty coverage, Thunderbolt/USB-C charging versatility, and bright IPS/OLED panels suitable for bright studio or campus environments.',
        coverImageUrl: '/src/assets/images/product_laptop_1794832026646.jpg',
        authorName: 'NOVARA Editorial',
        category: 'Tech Guides',
        tags: ['laptops', 'buying-guide', 'macbook'],
        isPublished: true,
        publishedAt: new Date(),
      },
      {
        title: 'Smartwatch Health Sensors Explained: What Matters Daily',
        slug: 'smartwatch-health-sensors-explained',
        excerpt: 'Understanding heart rate variability, sleep tracking, ECG, and battery optimization on modern wearables.',
        content: 'Modern wearables combine optical heart sensors, skin temperature tracking, and multi-axis accelerometers to deliver actionable daily readiness insights without sacrificing multi-day comfort.',
        coverImageUrl: '/src/assets/images/promo_smartwatch_1794832026084.jpg',
        authorName: 'NOVARA Editorial',
        category: 'Wearables',
        tags: ['smartwatch', 'fitness', 'apple-watch'],
        isPublished: true,
        publishedAt: new Date(),
      },
    ]);
  }

  // 8. Default Product Attribute Presets
  const attrCount = await ProductAttributePresetModel.countDocuments();
  if (attrCount === 0) {
    await ProductAttributePresetModel.insertMany([
      { name: 'Color', code: 'color', group: 'general', values: ['Midnight Black', 'Silver', 'Titanium Blue', 'Charcoal', 'White'], isActive: true },
      { name: 'Storage Capacity', code: 'storage', group: 'electronics', values: ['128GB', '256GB', '512GB', '1TB'], isActive: true },
      { name: 'Apparel & Shoe Size', code: 'size', group: 'general', values: ['S', 'M', 'L', 'XL', 'EU 40', 'EU 41', 'EU 42', 'EU 43'], isActive: true },
      { name: 'Warranty Coverage', code: 'warranty', group: 'electronics', values: ['6 Months', '1 Year Official', '2 Years Brand'], isActive: true },
    ]);
  }

  // 9. Default Customer Groups
  const groupCount = await CustomerGroupModel.countDocuments();
  if (groupCount === 0) {
    await CustomerGroupModel.insertMany([
      { name: 'Standard Shoppers', slug: 'standard', description: 'Default registered retail customers', discountPercent: 0, minOrders: 0, isActive: true },
      { name: 'VIP Members', slug: 'vip-members', description: 'Repeat high-value customers across Bangladesh', discountPercent: 5, minOrders: 3, isActive: true },
      { name: 'Corporate & B2B', slug: 'corporate-b2b', description: 'Bulk office & institutional buyers', discountPercent: 10, minOrders: 1, isActive: true },
    ]);
  }

  // 10. Default Discount Rule & Campaign
  const ruleCount = await DiscountRuleModel.countDocuments();
  if (ruleCount === 0) {
    await DiscountRuleModel.create({
      name: 'Bundle & Save 5% (3+ Items)',
      description: 'Automatic 5% cart savings when purchasing 3 or more units.',
      ruleType: 'bulk',
      value: 5,
      minQty: 3,
      minSpend: 2000,
      isActive: true,
    });
  }

  const campaignCount = await PromotionalCampaignModel.countDocuments();
  if (campaignCount === 0) {
    await PromotionalCampaignModel.create({
      title: 'Tech & Lifestyle Mega Deals',
      subtitle: 'Curated flagship gadgets, footwear, and daily essentials with nationwide delivery.',
      campaignType: 'special_offer',
      discountLabel: 'Up to 35% OFF',
      badgeText: 'Featured Campaign',
      bannerImageUrl: '/src/assets/images/promo_headphones_1794832024152.jpg',
      ctaUrl: '/shop?discount=true',
      isActive: true,
    });
  }

  return { seeded: true };
}

// Allow standalone CLI execution: `npm run seed`
const isMain = process.argv[1] && process.argv[1].endsWith('seed.ts');
if (isMain) {
  connectToMongoAtlas()
    .then(async (ok) => {
      if (!ok) {
        console.error('[NOVARA SEED] Cannot seed without MONGODB_URI.');
        process.exit(1);
      }
      const result = await runDatabaseSeed();
      console.info('[NOVARA SEED] Complete:', result);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[NOVARA SEED] Failed:', err);
      process.exit(1);
    });
}
