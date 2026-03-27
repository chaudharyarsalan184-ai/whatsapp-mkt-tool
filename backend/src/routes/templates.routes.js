import { Router } from 'express';
import * as templates from '../controllers/templates.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', templates.listTemplates);
router.get('/sync', templates.syncTemplates);
router.get('/:id', templates.getTemplate);
router.post('/', templates.createTemplate);
router.delete('/:id', templates.deleteTemplate);

export default router;
