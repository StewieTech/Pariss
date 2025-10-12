import { Request, Response } from 'express';
import { z } from 'zod';
import { handleChat } from '../services/chat.service';

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
