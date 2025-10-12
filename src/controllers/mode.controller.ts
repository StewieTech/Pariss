import { Request, Response } from 'express';

const userModes: Record<string, 'm1' | 'm2' | 'm3'> = {};

export async function setMode(req: Request, res: Response) {
  const { userId, mode } = req.body as { userId?: string; mode?: 'm1' | 'm2' | 'm3' };
  if (!mode) return res.status(400).json({ error: 'mode required' });
  const id = userId || 'anonymous';
  userModes[id] = mode;
  res.json({ mode });
}

export async function getMode(req: Request, res: Response) {
  const userId = (req.query.userId as string) || 'anonymous';
  res.json({ mode: userModes[userId] || 'm1' });
}
