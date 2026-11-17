import { z } from 'zod';

export const heroSlideSchema = z.object({
  badgeText: z.string().trim().max(60).default('Featured'),
  heading: z.string().trim().min(2).max(140),
  headlineLine2: z.string().trim().max(140).optional().default(''),
  subtitle: z.string().trim().max(300).optional().default(''),
  desktopImageUrl: z.string().trim().min(1),
  mobileImageUrl: z.string().trim().optional().default(''),
  cloudinaryPublicId: z.string().optional(),
  ctaText: z.string().trim().min(1).max(60).default('Shop Now'),
  ctaUrl: z
    .string()
    .trim()
    .refine(
      (url) => url.startsWith('/') || url.startsWith('https://') || url.startsWith('http://'),
      'CTA URL must be a relative path or valid HTTP/HTTPS URL.',
    )
    .default('/shop'),
  sortOrder: z.number().int().default(0),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

export type HeroSlideInput = z.infer<typeof heroSlideSchema>;
