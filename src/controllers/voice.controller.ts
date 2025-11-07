import { Request, Response } from 'express';
import { synthesize } from '../services/voice.service';

/**
 * Controller: POST /tts
 * Expects JSON { text: string, voiceId?: string }
 * Returns: raw base64 audio as plain text on success.
 */
export async function tts(req: Request, res: Response) {
  try {
    const { text, voiceId } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text (string) is required in the request body' });
    }

    const vid = (voiceId && String(voiceId)) || process.env.ELEVEN_VOICE_ID || 'LEnmbrrxYsUYS7vsRRwD';

    const { buffer, contentType } = await synthesize(text, vid);

    // Send back base64 string. Client expects the raw base64 text body.
    const b64 = buffer.toString('base64');
    // Set a hint header about the audio content type (useful for debugging)
    res.setHeader('X-Audio-Content-Type', contentType || 'audio/mpeg');
    res.type('text/plain');
    return res.send(b64);
  } catch (err: any) {
    console.error('voice.controller.tts error:', err?.message || err);
    const status = err?.status || 500;
    // Surface useful error details but avoid returning raw internal buffers
    return res.status(status).json({ error: err?.message || 'TTS failed', details: err?.body || undefined });
  }
}

export default { tts };
