import { buildSystemMessages } from '../utils/prompt';
import { saveTurn, getRecent } from '../repositories/message.repo';
import OpenAI from 'openai';

function getOpenAIClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set. Set it in your environment or .env file.');
  return new OpenAI({ apiKey: key });
}

export async function handleChat({ userId, text, mode }: { userId?: string; text: string; mode: 'm1' | 'm2' | 'm3' }) {
  // Local test shortcut: avoid DB and OpenAI calls when TEST_LOCAL=1
  if (process.env.TEST_LOCAL === '1') {
    const reply = `local-mock-reply: ${text}`;
    return { reply, tokens: { prompt: 0, completion: 0, total: 0 } } as any;
  }
  const system = buildSystemMessages(mode);
  let history: any[] = [];
  try {
    history = await getRecent(userId, 12);
  } catch (err: any) {
    // If DB isn't available (local test), continue with empty history
    console.warn('handleChat: getRecent failed, continuing with empty history', String(err));
    history = [];
  }

  const messages: any[] = [
    ...system,
    // include history as system/user/assistant turns (preserve original order)
    ...[...history]
      .reverse()
      .map((h: any) => ({ role: h.role as 'user' | 'assistant' | 'system', content: h.content })),
    { role: 'user', content: text }
  ];

  // call OpenAI Chat Completions
  const client = getOpenAIClient();
  let resp: any;
  try {
    resp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.6,
      max_tokens: 300
    });
  } catch (err: any) {
    console.error('OpenAI request failed', String(err));
    // throw a structured error for controller to translate into 502
    const e = new Error('OpenAI request failed');
    // attach original for logs
    (e as any).original = err;
    throw e;
  }

  const reply = resp?.choices?.[0]?.message?.content || 'Sorry, no reply.';

  try {
    await saveTurn(userId, 'user', mode, text);
  } catch (err: any) {
    console.warn('handleChat: failed to save user turn', String(err));
  }
  try {
    await saveTurn(userId, 'assistant', mode, reply);
  } catch (err: any) {
    console.warn('handleChat: failed to save assistant turn', String(err));
  }

  return { reply, tokens: resp.usage };
}
