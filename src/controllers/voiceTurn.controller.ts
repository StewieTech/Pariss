import { Request, Response } from 'express';
import { z } from 'zod';
import OpenAI from 'openai';
import { handleChat } from '../services/chat.service';
import { transcribeAudio } from '../services/transcription.service';
import { synthesize, type TtsProvider } from '../services/voice.service';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, normalizeLanguage } from '../utils/language';

const SupportedLanguageSchema = z.enum(SUPPORTED_LANGUAGES);

const VoiceTurnSchema = z.object({
  audioBase64: z.string().min(1),
  mimeType: z.string().min(1).default('audio/mp4'),
  language: SupportedLanguageSchema.optional().default(DEFAULT_LANGUAGE),
  mode: z.literal('m3').optional().default('m3'),
  conversationId: z.string().min(1),
  voiceId: z.string().min(1).optional(),
  ttsProvider: z.enum(['openai', 'elevenlabs']).optional().default('openai'),
  speed: z.number().min(0.25).max(4.0).optional().default(1.0),
});

function decodeAudioBase64(audioBase64: string) {
  const cleaned = String(audioBase64 || '')
    .replace(/^data:[^,]+,/, '')
    .trim();

  if (!cleaned) return Buffer.alloc(0);
  return Buffer.from(cleaned, 'base64');
}

export async function postVoiceTurn(req: Request, res: Response) {
  const parsed = VoiceTurnSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  try {
    const totalStartedAt = Date.now();
    const {
      audioBase64,
      mimeType,
      language,
      mode,
      conversationId,
      voiceId,
      ttsProvider,
      speed,
    } = parsed.data;
    const selectedLanguage = normalizeLanguage(language);
    const audioBuffer = decodeAudioBase64(audioBase64);

    console.log('voiceTurn: audioBuffer bytes:', audioBuffer.length, 'mimeType:', mimeType, 'language:', selectedLanguage);

    if (!audioBuffer.length) {
      return res.status(400).json({ error: 'audioBase64 did not contain any audio bytes' });
    }

    const sttStartedAt = Date.now();
    const transcription = await transcribeAudio({ audioBuffer, mimeType });
    const sttMs = Date.now() - sttStartedAt;
    const transcript = String(transcription.text || '').trim();

    if (!transcript) {
      return res.status(422).json({
        error: 'No speech detected. Try again with a slightly longer recording.',
      });
    }

    const llmStartedAt = Date.now();
    const chat = await handleChat({
      userId: (req as any).userId,
      conversationId,
      text: transcript,
      mode,
      language: selectedLanguage,
    });
    const llmMs = Date.now() - llmStartedAt;

    const resolvedVoiceId =
      (voiceId && String(voiceId)) ||
      process.env.ELEVEN_VOICE_ID ||
      'LEnmbrrxYsUYS7vsRRwD';

    // Strip bracketed English glosses for TTS so Lola speaks cleanly
    const ttsText = chat.reply.replace(/\s*\[[^\]]*\]/g, '');

    const ttsStartedAt = Date.now();
    const audio = await synthesize(ttsText, resolvedVoiceId, ttsProvider as TtsProvider, speed);
    const ttsMs = Date.now() - ttsStartedAt;

    // Quick English translation (non-blocking best-effort)
    let englishTranslation = '';
    try {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) throw new Error('OPENAI_API_KEY not set');
      const oai = new OpenAI({ apiKey: openaiKey });
      const transResp = await oai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Translate the following text to natural English. Return ONLY the English translation, nothing else.' },
          { role: 'user', content: chat.reply.replace(/\s*\[[^\]]*\]/g, '') },
        ],
        temperature: 0.2,
        max_tokens: 300,
      });
      englishTranslation = transResp.choices?.[0]?.message?.content?.trim() || '';
    } catch (e) {
      console.warn('English translation failed (non-critical):', (e as any)?.message);
    }

    return res.json({
      transcript,
      assistantText: chat.reply,
      englishTranslation,
      audioBase64: audio.buffer.toString('base64'),
      audioContentType: audio.contentType || 'audio/mpeg',
      selectedLanguage,
      conversationId,
      speed,
      timings: {
        sttMs,
        llmMs,
        ttsMs,
        totalMs: Date.now() - totalStartedAt,
      },
    });
  } catch (err: any) {
    console.error('voiceTurn.controller error:', err?.message || err);
    return res.status(err?.status || 500).json({
      error: err?.message || 'voice turn failed',
      details: err?.body || undefined,
    });
  }
}

export default { postVoiceTurn };
