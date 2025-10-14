import { Request, Response } from 'express';
import { z } from 'zod';
import { handleChat } from '../services/chat.service';
import { translateOnly } from '../services/translate.service';
import { buildTranslatePrompt } from '../utils/prompt';

const SendMessageSchema = z.object({ text: z.string().min(1), mode: z.enum(['m1', 'm2', 'm3']) });

export async function postSend(req: Request, res: Response) {
  const parsed = SendMessageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
  try {
    const { text, mode } = parsed.data;
    const result = await handleChat({ text, mode });
    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'server error' });
  }
}

const TranslateSchema = z.object({ text: z.string().min(1) });

export async function postTranslate(req: Request, res: Response) {
  const parsed = TranslateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
  try {
  const prompt = buildTranslatePrompt(parsed.data.text);
  // Use an isolated translate service that does NOT include prior conversation history
  const result = await translateOnly({ prompt });
    // attempt to parse JSON array from reply
    let variants: string[] = [];
    try {
      let candidate = String(result.reply || '').trim();

      // Strip Markdown code fences and language tags: ```json ... ```
      candidate = candidate.replace(/```(?:\w+)?\n([\s\S]*?)```/i, '$1').trim();

      // Remove surrounding triple backticks if any remain
      candidate = candidate.replace(/(^```|```$)/g, '').trim();

      // If the payload contains a JSON array somewhere (like [ ... ]), try to extract and parse it
      const firstBracket = candidate.indexOf('[');
      const lastBracket = candidate.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        const jsonChunk = candidate.substring(firstBracket, lastBracket + 1);
        try {
          const parsed = JSON.parse(jsonChunk);
          if (Array.isArray(parsed)) {
            variants = parsed.map((v: any) => {
              if (v == null) return '';
              if (typeof v === 'string') return v;
              if (typeof v === 'object') {
                return String(v.text ?? v.reply ?? v.content ?? JSON.stringify(v));
              }
              return String(v);
            });
          }
        } catch (jsonErr) {
          // fall through to other parsing strategies
          console.warn('postTranslate: JSON parse failed on chunk', jsonErr);
        }
      }

      // If not parsed yet, try to extract labeled lines like "Casual: ..."
      if (variants.length === 0) {
        const reLabel = /(?:Casual:|casual:|Formal:|formal:|Playful:|playful:)\s*(.*)/g;
        const matches: string[] = [];
        let m: RegExpExecArray | null;
        while ((m = reLabel.exec(candidate)) !== null) {
          if (m[1]) matches.push(m[1].trim());
          if (matches.length >= 3) break;
        }
        if (matches.length) variants = matches.slice(0,3);
      }

      // If still empty, try to extract quoted strings ("...")
      if (variants.length === 0) {
        const qre = /["“”']([^"“”']+)["“”']/g;
        const matches: string[] = [];
        let mm: RegExpExecArray | null;
        while ((mm = qre.exec(candidate)) !== null) {
          matches.push(mm[1].trim());
          if (matches.length >= 3) break;
        }
        if (matches.length) variants = matches.slice(0,3);
      }

      // Final fallback: split into non-empty lines and remove noise tokens
      if (variants.length === 0) {
        variants = candidate.split(/\r?\n/)
          .map((s: string) => s.trim())
          .filter(Boolean)
          .filter(l => !l.startsWith('```') && l !== '[' && l !== ']')
          .slice(0,3);
      }
    } catch (parseErr) {
      console.warn('postTranslate: parse failed', parseErr);
      variants = [String(result.reply)];
    }
    return res.json({ variants });
  } catch (err: any) {
    console.error('postTranslate error', err);
    return res.status(500).json({ error: err.message || 'server error' });
  }
}
