import { Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { User } from '../models/User';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function signToken(userId: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const opts: SignOptions = { expiresIn: expiresIn as any, subject: userId };
  return jwt.sign({}, secret, opts);
}

function publicUser(u: any) {
  return {
    id: String(u._id),
    email: u.email,
    profile: u.profile || {},
  };
}

export async function register(req: Request, res: Response) {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  const email = parsed.data.email.toLowerCase().trim();
  const password = parsed.data.password;

  const existing = await User.findOne({ email }).lean();
  if (existing) return res.status(409).json({ error: 'email already registered' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, passwordHash, profile: {} });

  const token = signToken(String(user._id));
  return res.json({ token, user: publicUser(user) });
}

export async function login(req: Request, res: Response) {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  const email = parsed.data.email.toLowerCase().trim();
  const password = parsed.data.password;

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: 'invalid credentials' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });

  const token = signToken(String(user._id));
  return res.json({ token, user: publicUser(user) });
}
