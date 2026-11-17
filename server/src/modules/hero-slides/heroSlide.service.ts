import { HeroSlideModel } from './heroSlide.model';
import type { HeroSlideInput } from './heroSlide.validation';
import { AppError } from '../../middleware/error.middleware';

export async function listHeroSlides(params: { q?: string; status?: string }) {
  const filter: Record<string, unknown> = {};
  if (params.status === 'active') filter.isActive = true;
  if (params.status === 'inactive') filter.isActive = false;
  if (params.q) {
    const regex = new RegExp(params.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ heading: regex }, { headlineLine2: regex }, { badgeText: regex }, { subtitle: regex }];
  }
  const slides = await HeroSlideModel.find(filter).sort({ sortOrder: 1, createdAt: -1 }).lean();
  return slides.map((s) => ({ ...s, id: String(s._id) }));
}

export async function getHeroSlideById(id: string) {
  const slide = await HeroSlideModel.findById(id).lean();
  if (!slide) throw new AppError(404, 'HERO_SLIDE_NOT_FOUND', 'Hero slide not found.');
  return { ...slide, id: String(slide._id) };
}

export async function createHeroSlide(input: HeroSlideInput) {
  const slide = await HeroSlideModel.create({
    ...input,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
  });
  return { ...slide.toObject(), id: String(slide._id) };
}

export async function updateHeroSlide(id: string, input: HeroSlideInput) {
  const updated = await HeroSlideModel.findByIdAndUpdate(
    id,
    {
      $set: {
        ...input,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
      },
    },
    { new: true },
  );
  if (!updated) throw new AppError(404, 'HERO_SLIDE_NOT_FOUND', 'Hero slide not found.');
  return { ...updated.toObject(), id: String(updated._id) };
}

export async function deleteHeroSlide(id: string) {
  const slide = await HeroSlideModel.findById(id);
  if (!slide) throw new AppError(404, 'HERO_SLIDE_NOT_FOUND', 'Hero slide not found.');
  await slide.deleteOne();
  return { id };
}
