import express from 'express';
import { postSend } from '../controllers/chat.controller';

const router = express.Router();

router.post('/send', postSend);

export default router;
