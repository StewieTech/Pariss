import express from 'express';
import { postSend, postTranslate } from '../controllers/chat.controller';
import { postVoiceTurn } from '../controllers/voiceTurn.controller';

const router = express.Router();

router.post('/send', postSend);
router.post('/translate', postTranslate);
router.post('/voice-turn', postVoiceTurn);

export default router;
