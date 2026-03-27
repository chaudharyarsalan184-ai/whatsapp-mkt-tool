import { Router } from 'express';
import * as campaigns from '../controllers/campaigns.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', campaigns.listCampaigns);
router.get('/:id', campaigns.getCampaign);
router.post('/', campaigns.createCampaign);
router.post('/:id/send', campaigns.sendCampaign);
router.delete('/:id', campaigns.deleteCampaign);

export default router;
