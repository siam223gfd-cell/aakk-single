import { Router } from 'express';
import { requireDatabase } from '../../database/connection';
import { authenticateRequired, requirePermission } from '../../middleware/auth.middleware';
import {
  createHeroSlideController,
  deleteHeroSlideController,
  getHeroSlideController,
  listHeroSlidesController,
  updateHeroSlideController,
} from './heroSlide.controller';

const router = Router();
router.use(requireDatabase, authenticateRequired);

router.get('/hero-slides', requirePermission('cms.manage'), listHeroSlidesController);
router.get('/hero-slides/:id', requirePermission('cms.manage'), getHeroSlideController);
router.post('/hero-slides', requirePermission('cms.manage'), createHeroSlideController);
router.put('/hero-slides/:id', requirePermission('cms.manage'), updateHeroSlideController);
router.delete('/hero-slides/:id', requirePermission('cms.manage'), deleteHeroSlideController);

export default router;
