import { Router } from 'express';
import * as webhook from '../controllers/webhook.controller.js';

const router = Router();

router.get('/', webhook.verifyWebhook);
router.post('/', webhook.receiveWebhook);

export default router;
