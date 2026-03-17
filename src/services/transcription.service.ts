import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

function getOpenAIClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set. Set it in your environment or .env file.');
  return new OpenAI({ apiKey: key });
}

function getTranscriptionModel() {
  return process.env.OPENAI_STT_MODEL || 'gpt-4o-mini-transcribe';
}

function getFilenameForMimeType(mimeType: string) {
  const safeMimeType = String(mimeType || '').toLowerCase();

  if (safeMimeType.includes('webm')) return 'voice-turn.webm';
  if (safeMimeType.includes('mpeg') || safeMimeType.includes('mp3')) return 'voice-turn.mp3';
  if (safeMimeType.includes('wav')) return 'voice-turn.wav';
  if (safeMimeType.includes('caf')) return 'voice-turn.caf';
  return 'voice-turn.m4a';
}

export async function transcribeAudio({
  audioBuffer,
  mimeType = 'audio/mp4',
}: {
  audioBuffer: Buffer;
  mimeType?: string;
}) {
  if (!audioBuffer?.length) throw new Error('audioBuffer is required for transcription');

  const model = getTranscriptionModel();
  const client = getOpenAIClient();
  const safeMimeType = String(mimeType || 'audio/mp4').trim() || 'audio/mp4';
  const file = await toFile(audioBuffer, getFilenameForMimeType(safeMimeType), {
    type: safeMimeType,
  });

  const response = await client.audio.transcriptions.create({
    file,
    model,
    response_format: 'json',
  });

  const text = String((response as any)?.text ?? response ?? '').trim();

  return { text, model };
}

export default { transcribeAudio };
