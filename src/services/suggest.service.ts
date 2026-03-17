import OpenAI from 'openai';
import { buildMasterPrompt, buildSuggestPrompt } from '../utils/prompt';
import { DEFAULT_LANGUAGE, normalizeLanguage, type SupportedLanguage } from '../utils/language';

function getOpenAIClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set.');
  return new OpenAI({ apiKey: key });
}

export async function getSuggestions({
  text,
  language = DEFAULT_LANGUAGE,
}: {
  text: string;
  language?: SupportedLanguage;
}) {
  const client = getOpenAIClient();
  const selectedLanguage = normalizeLanguage(language);
  const prompt = buildSuggestPrompt(text, selectedLanguage);
  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: buildMasterPrompt(selectedLanguage) },
      { role: 'system', content: 'You are a reply suggestion assistant. Return only JSON arrays when possible.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.4,
    max_tokens: 400
  });
  const reply = resp?.choices?.[0]?.message?.content || '';
  return { reply, usage: resp.usage };
}
