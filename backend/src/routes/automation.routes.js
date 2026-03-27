import { Router } from 'express';
import * as automation from '../controllers/automation.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', automation.listAutomations);
router.post('/', automation.createAutomation);
router.put('/:id', automation.updateAutomation);
router.delete('/:id', automation.deleteAutomation);
router.put('/:id/toggle', automation.toggleAutomation);

export default router;
