import { Response } from 'express';
import { z } from 'zod';
import path from 'path';
import type { AuthRequest } from '../middleware/auth';
import { User, type Gender } from '../models/User';

function publicUser(u: any) {
  return {
    id: String(u._id),
    email: u.email,
    profile: u.profile || {},
  };
}

export async function getMe(req: AuthRequest, res: Response) {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: 'unauthorized' });

  const user = await User.findById(userId).lean();
  if (!user) return res.status(404).json({ error: 'user not found' });

  return res.json({ user: publicUser(user) });
}

const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  gender: z.enum(['male', 'female', 'nonbinary', 'prefer_not_to_say']).optional(),
  location: z.string().max(120).optional(),
  learningLanguage: z.string().max(80).optional(),
});

export async function patchProfile(req: AuthRequest, res: Response) {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: 'unauthorized' });

  const parsed = UpdateProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  const update: any = {};
  if (parsed.data.name != null) update['profile.name'] = parsed.data.name.trim();
  if (parsed.data.gender != null) update['profile.gender'] = parsed.data.gender as Gender;
  if (parsed.data.location != null) update['profile.location'] = parsed.data.location.trim();
  if (parsed.data.learningLanguage != null) update['profile.learningLanguage'] = parsed.data.learningLanguage.trim();

  const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true }).lean();
  if (!user) return res.status(404).json({ error: 'user not found' });

  return res.json({ user: publicUser(user) });
}

export async function postPhoto(req: AuthRequest, res: Response) {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: 'unauthorized' });

  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: 'missing file' });

  // Stored under /uploads, served by express.static in server.ts
  const relUrl = `/uploads/${path.basename(file.path)}`;

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { 'profile.photoUrl': relUrl } },
    { new: true }
  ).lean();

  if (!user) return res.status(404).json({ error: 'user not found' });

  return res.json({ user: publicUser(user) });
}
