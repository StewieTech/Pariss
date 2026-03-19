import OpenAI from 'openai';

export type TtsProvider = 'openai' | 'elevenlabs';

type SynthResult = { buffer: Buffer; contentType: string };

// --------------- OpenAI TTS (default — cheaper, lower latency) ---------------

const DEFAULT_OPENAI_VOICE = 'nova';
const DEFAULT_OPENAI_TTS_MODEL = 'tts-1';

const VALID_OPENAI_VOICES = ['nova', 'shimmer', 'echo', 'onyx', 'fable', 'alloy', 'ash', 'sage', 'coral'] as const;

async function synthesizeOpenAI(text: string, _voiceIdIgnored?: string, speed: number = 1.0): Promise<SynthResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set in environment');

  const preferred = (process.env.OPENAI_TTS_VOICE || DEFAULT_OPENAI_VOICE).toLowerCase();
  const voice = VALID_OPENAI_VOICES.includes(preferred as any) ? preferred : DEFAULT_OPENAI_VOICE;

  const client = new OpenAI({ apiKey: key });
  const response = await client.audio.speech.create({
    model: process.env.OPENAI_TTS_MODEL || DEFAULT_OPENAI_TTS_MODEL,
    voice: voice as any,
    input: text,
    response_format: 'mp3',
    speed: Math.max(0.25, Math.min(4.0, speed)),
  });

  const ab = await response.arrayBuffer();
  return { buffer: Buffer.from(ab), contentType: 'audio/mpeg' };
}

// --------------- ElevenLabs TTS (premium — richer voices) ---------------

async function synthesizeElevenLabs(text: string, voiceId: string): Promise<SynthResult> {
  const apiKey = process.env.ELEVEN_API_KEY;
  if (!apiKey) throw new Error('ELEVEN_API_KEY not set in environment');

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({ text }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '[no body]');
    const err = new Error(`ElevenLabs TTS failed: ${resp.status} ${String(body).slice(0,200)}`);
    (err as any).status = resp.status;
    (err as any).body = body;
    throw err;
  }

  const ab = await resp.arrayBuffer();
  const buf = Buffer.from(ab);
  const contentType = resp.headers.get('content-type') || 'application/octet-stream';
  return { buffer: buf, contentType };
}

// --------------- Unified entry point ---------------

export async function synthesize(
  text: string,
  voiceId: string,
  provider: TtsProvider = 'openai',
  speed: number = 1.0
): Promise<SynthResult> {
  if (!text) throw new Error('text required');

  if (provider === 'elevenlabs') {
    return synthesizeElevenLabs(text, voiceId);
  }
  return synthesizeOpenAI(text, voiceId, speed);
}

export default { synthesize };
