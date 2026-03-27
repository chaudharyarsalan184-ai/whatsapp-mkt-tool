import { Router } from 'express';
import * as analytics from '../controllers/analytics.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/overview', analytics.overview);
router.get('/campaigns', analytics.campaignStats);
router.get('/messages', analytics.messagesPerDay);
router.get('/funnel', analytics.funnel);

export default router;
