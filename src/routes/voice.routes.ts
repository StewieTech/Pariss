import express from 'express';
import voiceController from '../controllers/voice.controller';

const router = express.Router();

// POST /tts -> produces base64 audio in the response body
router.post('/tts', voiceController.tts);

export default router;
