import OpenAI from 'openai';
import { MASTER_PROMPT, buildSuggestPrompt } from '../utils/prompt';

function getOpenAIClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set.');
  return new OpenAI({ apiKey: key });
}

export async function getSuggestions({ text }: { text: string }) {
  const client = getOpenAIClient();
  const prompt = buildSuggestPrompt(text);
  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: MASTER_PROMPT },
      { role: 'system', content: 'You are a reply suggestion assistant. Return only JSON arrays when possible.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.4,
    max_tokens: 400
  });
  const reply = resp?.choices?.[0]?.message?.content || '';
  return { reply, usage: resp.usage };
}
