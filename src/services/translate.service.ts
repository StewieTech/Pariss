import OpenAI from 'openai';

function getOpenAIClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set.');
  return new OpenAI({ apiKey: key });
}

export async function translateOnly({ prompt }: { prompt: string }) {
  // This function intentionally does NOT include chat history or the global MASTER_PROMPT.
  // It uses a minimal neutral system message to keep translations deterministic and isolated.
  const system = [{ role: 'system' as const, content: 'You are a helpful translator. Return only the requested translations.' }];

  const client = getOpenAIClient();
  const resp = await client.chat.completions.create({
    // model: 'gpt-5-nano',
    model: 'gpt-4o-mini',
    messages: [
      ...system,
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    // max_completion_tokens: 400
    max_tokens: 400
  });

  const reply = resp?.choices?.[0]?.message?.content || '';
  return { reply, usage: resp.usage };
}
