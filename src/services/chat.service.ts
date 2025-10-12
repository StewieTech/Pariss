import { buildSystemMessages } from '../utils/prompt';
import { saveTurn, getRecent } from '../repositories/message.repo';
import OpenAI from 'openai';

function getOpenAIClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set. Set it in your environment or .env file.');
  return new OpenAI({ apiKey: key });
}

export async function handleChat({ userId, text, mode }: { userId?: string; text: string; mode: 'm1' | 'm2' | 'm3' }) {
  const system = buildSystemMessages(mode);
  const history = await getRecent(userId, 12);

  const messages: any[] = [
    ...system,
    // include history as system/user/assistant turns
    ...history
      .reverse()
      .map((h: any) => ({ role: h.role as 'user' | 'assistant' | 'system', content: h.content })),
    { role: 'user', content: text }
  ];

  // call OpenAI Chat Completions
  const client = getOpenAIClient();
  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.6,
    max_tokens: 300
  });

  const reply = resp.choices?.[0]?.message?.content || 'Sorry, no reply.';

  await saveTurn(userId, 'user', mode, text);
  await saveTurn(userId, 'assistant', mode, reply);

  return { reply, tokens: resp.usage };
}
