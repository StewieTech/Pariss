import { Request, Response } from 'express';
import { getRecent } from '../repositories/message.repo';

export async function getHistory(req: Request, res: Response) {
  const userId = req.query.userId as string | undefined;
  const limit = parseInt((req.query.limit as string) || '50', 10);
  try {
    const msgs = await getRecent(userId, limit);
    res.json({ messages: msgs });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'server error' });
  }
}
