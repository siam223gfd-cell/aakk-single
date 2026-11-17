import mongoose, { Schema, type Document } from 'mongoose';

export interface IHeroSlide extends Document {
  badgeText: string;
  heading: string;
  headlineLine2?: string;
  subtitle: string;
  desktopImageUrl: string;
  mobileImageUrl?: string;
  cloudinaryPublicId?: string;
  ctaText: string;
  ctaUrl: string;
  sortOrder: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const HeroSlideSchema = new Schema<IHeroSlide>(
  {
    badgeText: { type: String, default: 'Featured', trim: true, maxlength: 60 },
    heading: { type: String, required: true, trim: true, maxlength: 140 },
    headlineLine2: { type: String, trim: true, maxlength: 140 },
    subtitle: { type: String, default: '', trim: true, maxlength: 300 },
    desktopImageUrl: { type: String, required: true, trim: true },
    mobileImageUrl: { type: String, trim: true },
    cloudinaryPublicId: { type: String },
    ctaText: { type: String, default: 'Shop Now', trim: true, maxlength: 60 },
    ctaUrl: { type: String, default: '/shop', trim: true, maxlength: 300 },
    sortOrder: { type: Number, default: 0, index: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const HeroSlideModel = mongoose.models.HeroSlide || mongoose.model<IHeroSlide>('HeroSlide', HeroSlideSchema);
