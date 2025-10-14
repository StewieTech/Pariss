import express from 'express';
import { postSend, postTranslate } from '../controllers/chat.controller';

const router = express.Router();

router.post('/send', postSend);
router.post('/translate', postTranslate);

export default router;
