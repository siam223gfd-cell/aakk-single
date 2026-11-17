import type { Response, NextFunction } from 'express';
import { recordAuditLog, type AuthenticatedRequest } from '../../middleware/auth.middleware';
import { sendCreated, sendSuccess } from '../../utils/apiResponse';
import { heroSlideSchema } from './heroSlide.validation';
import {
  createHeroSlide,
  deleteHeroSlide,
  getHeroSlideById,
  listHeroSlides,
  updateHeroSlide,
} from './heroSlide.service';

export async function listHeroSlidesController(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const slides = await listHeroSlides({
      q: String(req.query.q || '').trim(),
      status: String(req.query.status || '').trim(),
    });
    sendSuccess(res, { slides });
  } catch (err) {
    next(err);
  }
}

export async function getHeroSlideController(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const slide = await getHeroSlideById(req.params.id);
    sendSuccess(res, { slide });
  } catch (err) {
    next(err);
  }
}

export async function createHeroSlideController(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const parsed = heroSlideSchema.parse(req.body);
    const slide = await createHeroSlide(parsed);
    await recordAuditLog({
      actor: req.user,
      action: 'hero_slide.create',
      resourceType: 'HeroSlide',
      resourceId: slide.id,
      summary: `Created hero slide "${slide.heading}"`,
    });
    sendCreated(res, { slide });
  } catch (err) {
    next(err);
  }
}

export async function updateHeroSlideController(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const parsed = heroSlideSchema.parse(req.body);
    const slide = await updateHeroSlide(req.params.id, parsed);
    await recordAuditLog({
      actor: req.user,
      action: 'hero_slide.update',
      resourceType: 'HeroSlide',
      resourceId: slide.id,
      summary: `Updated hero slide "${slide.heading}"`,
    });
    sendSuccess(res, { slide });
  } catch (err) {
    next(err);
  }
}

export async function deleteHeroSlideController(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = await deleteHeroSlide(req.params.id);
    await recordAuditLog({
      actor: req.user,
      action: 'hero_slide.delete',
      resourceType: 'HeroSlide',
      resourceId: id,
      summary: `Deleted hero slide ${id}`,
    });
    sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}
