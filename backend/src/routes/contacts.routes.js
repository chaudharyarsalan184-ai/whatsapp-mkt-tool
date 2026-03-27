import { Router } from 'express';
import multer from 'multer';
import os from 'os';
import * as contacts from '../controllers/contacts.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { usOnlyBody } from '../middleware/usOnly.js';

const upload = multer({ dest: os.tmpdir() });
const router = Router();

router.use(authMiddleware);

router.get('/', contacts.listContacts);
router.get('/tags', contacts.getTags);
router.post('/', usOnlyBody, contacts.createContact);
router.put('/:id', contacts.updateContact);
router.delete('/:id', contacts.deleteContact);
router.post('/:id/opt-out', contacts.optOutContact);
router.post('/import', upload.single('file'), contacts.importCsv);

export default router;
