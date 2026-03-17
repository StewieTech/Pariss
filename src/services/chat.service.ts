import { buildSystemMessages } from '../utils/prompt';
import { DEFAULT_LANGUAGE, normalizeLanguage, type SupportedLanguage } from '../utils/language';
import { saveTurn, getRecent } from '../repositories/message.repo';
import OpenAI from 'openai';

function getOpenAIClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set. Set it in your environment or .env file.');
  return new OpenAI({ apiKey: key });
}

function getChatModel(language?: SupportedLanguage) {
  if (language === 'german') return 'gpt-5-nano';
  return process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
}

async function normalizeReplyLanguage(reply: string, language: SupportedLanguage) {
  const text = String(reply || '').trim();
  if (!text) return text;

  const client = getOpenAIClient();
  const languageLabel = language.charAt(0).toUpperCase() + language.slice(1);
  const resp = await client.chat.completions.create({
    model: getChatModel(language),
    messages: [
      {
        role: 'system',
        content:
          `You are a strict language normalizer. Rewrite assistant replies so the target-language teaching content is in ${languageLabel}. ` +
          `Preserve meaning, tone, emojis, and structure. Preserve bracketed English glosses in English. ` 
      },
      {
        role: 'user',
        content:
          `Target language: ${languageLabel}\n` +
          `Rewrite this assistant reply into ${languageLabel}. If it is already fully in ${languageLabel}, return it unchanged.\n\n` +
          `Reply:\n"""${text}"""`,
      },
    ],
    temperature: 0.1,
    max_tokens: 300,
  });

  return String(resp?.choices?.[0]?.message?.content || text).trim() || text;
}

export async function handleChat({
  userId,
  conversationId,
  text,
  mode,
  language = DEFAULT_LANGUAGE,
}: {
  userId?: string;
  conversationId?: string;
  text: string;
  mode: 'm1' | 'm2' | 'm3';
  language?: SupportedLanguage;
}) {
  // Local test shortcut: avoid DB and OpenAI calls when TEST_LOCAL=1
  if (process.env.TEST_LOCAL === '1') {
    const reply = `local-mock-reply: ${text}`;
    return { reply, tokens: { prompt: 0, completion: 0, total: 0 } } as any;
  }
  const selectedLanguage = normalizeLanguage(language);
  const historyScope = conversationId
    ? `chat:${conversationId}`
    : userId;
  const languageLabel = selectedLanguage.charAt(0).toUpperCase() + selectedLanguage.slice(1);
  const system = [
    ...buildSystemMessages(mode, selectedLanguage),
    {
      role: 'system' as const,
      content: `IMPORTANT: The target language is ${languageLabel}. You MUST reply in ${languageLabel} only (with English glosses in brackets). Do NOT use any other language. Ignore prior turns in other target languages.`,
    },
  ];
  let history: any[] = [];
  try {
    history = await getRecent(historyScope, 12, {
      mode,
      language: selectedLanguage,
    });
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
    { role: 'user', content: `[Language: ${languageLabel}] ${text}` }
  ];

  // call OpenAI Chat Completions
  const client = getOpenAIClient();
  let resp: any;
  try {
    resp = await client.chat.completions.create({
      model: getChatModel(selectedLanguage),
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

  const rawReply = resp?.choices?.[0]?.message?.content || 'Sorry, no reply.';
  let reply = String(rawReply);
  try {
    reply = await normalizeReplyLanguage(reply, selectedLanguage);
  } catch (err: any) {
    console.warn('handleChat: language normalization failed, returning raw reply', String(err));
  }

  try {
    await saveTurn(historyScope, 'user', mode, text, selectedLanguage);
  } catch (err: any) {
    console.warn('handleChat: failed to save user turn', String(err));
  }
  try {
    await saveTurn(historyScope, 'assistant', mode, reply, selectedLanguage);
  } catch (err: any) {
    console.warn('handleChat: failed to save assistant turn', String(err));
  }

  return { reply, tokens: resp.usage };
}
