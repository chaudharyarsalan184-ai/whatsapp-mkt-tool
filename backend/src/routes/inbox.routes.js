import { Router } from 'express';
import * as inbox from '../controllers/inbox.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { usOnlyParam } from '../middleware/usOnly.js';

const router = Router();

router.use(authMiddleware);

router.get('/unread-count', inbox.unreadCount);
router.get('/', inbox.listConversations);
router.get('/:phone', usOnlyParam, inbox.getThread);
router.post('/:phone/reply', usOnlyParam, inbox.reply);
router.put('/:phone/read', usOnlyParam, inbox.markRead);

export default router;
