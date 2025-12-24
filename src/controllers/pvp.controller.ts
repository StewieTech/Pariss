// src/controllers/pvp.controller.ts
import { Request, Response } from 'express';
import { getDb } from '../lib/mongo';

// Suggest replies service
import { getSuggestions as suggestService } from '../services/suggest.service';

type MessageDoc = {
  roomId: string;
  author: string;
  text: string;
  ts: number;
};

type RoomDoc = {
  _id: string;
  createdAt: number;
  updatedAt: number;
  participants?: string[];
};

function makeId(len = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function parseSinceTs(req: Request): number {
  const raw = (req.query?.sinceTs ?? req.query?.since ?? req.query?.fromTs) as any;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseLimit(req: Request): number {
  const raw = req.query?.limit as any;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 20;
  return Math.min(100, Math.floor(n));
}

function parseSinceUpdatedAt(req: Request): number {
  const raw = (req.query?.sinceUpdatedAt ?? req.query?.sinceUpdated ?? req.query?.since) as any;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Collections
const ROOMS = 'pvp_rooms';
const MSGS = 'pvp_messages';

// Create a room
export async function createRoom(_req: Request, res: Response) {
  const id = makeId();
  const db = await getDb();

  const now = Date.now();

  await db.collection<RoomDoc>(ROOMS).insertOne({
    _id: id,
    createdAt: now,
    updatedAt: now,
    participants: [], // string[]
  });

  // keep your existing response shape
  return res.json({ roomId: id, joinPath: `/pvp/${id}` });
}

// List rooms (backend-driven active rooms)
// GET /pvp/rooms?limit=20&sinceUpdatedAt=...ms
export async function listRooms(req: Request, res: Response) {
  try {
    const db = await getDb();
    const limit = parseLimit(req);
    const sinceUpdatedAt = parseSinceUpdatedAt(req);

    const query: any = {};
    if (sinceUpdatedAt > 0) query.updatedAt = { $gt: sinceUpdatedAt };

    const rooms = await db
      .collection<RoomDoc>(ROOMS)
      .find(query)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();

    return res.json({
      ok: true,
      rooms: rooms.map((r) => ({
        roomId: r._id,
        createdAt: Number((r as any).createdAt || 0),
        updatedAt: Number((r as any).updatedAt || 0),
        participantCount: Array.isArray((r as any).participants)
          ? ((r as any).participants as string[]).length
          : 0,
        participants: Array.isArray((r as any).participants)
          ? (((r as any).participants as string[]).slice(0, 50))
          : undefined,
        joinPath: `/pvp/${r._id}`,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}

// Join a room
export async function joinRoom(req: Request, res: Response) {
  const { id } = req.params;
  const author = String(req.body?.author || req.body?.name || '').trim();
  if (!author) return res.status(400).json({ error: 'name required' });

  const db = await getDb();

  const room = await db.collection<RoomDoc>(ROOMS).findOne({ _id: id });
  if (!room) return res.status(404).json({ error: 'room not found' });

  await db.collection<RoomDoc>(ROOMS).updateOne(
    { _id: id },
    {
      $addToSet: { participants: author },
      $set: { updatedAt: Date.now() },
    }
  );

  // Return last 200 messages (like your in-memory cap)
  const messages = await db
    .collection<MessageDoc>(MSGS)
    .find({ roomId: id })
    .sort({ ts: 1 })
    .limit(200)
    .toArray();

  const updatedRoom = await db.collection<RoomDoc>(ROOMS).findOne({ _id: id });

  return res.json({
    ok: true,
    roomId: id,
    participants: ((updatedRoom as any)?.participants || []) as string[],
    messages: messages.map((m) => ({ author: m.author, text: m.text, ts: m.ts })),
  });
}

// Post a message
export async function postMessage(req: Request, res: Response) {
  const { id } = req.params;

  // ✅ accept both author and name (your client sends author)
  const author = String(req.body?.author || req.body?.name || '').trim();
  const text = String(req.body?.text || '').trim();

  if (!author || !text) return res.status(400).json({ error: 'author/name and text required' });

  const db = await getDb();

  const room = await db.collection<RoomDoc>(ROOMS).findOne({ _id: id });
  if (!room) return res.status(404).json({ error: 'room not found' });

  const msg: MessageDoc = { roomId: id, author: author, text, ts: Date.now() };

  await db.collection<MessageDoc>(MSGS).insertOne(msg);

  // keep room updated + add participant if new
  await db.collection<RoomDoc>(ROOMS).updateOne(
    { _id: id },
    {
      $addToSet: { participants: author },
      $set: { updatedAt: Date.now() },
    }
  );

  // Optional: keep messages bounded to last 200 by deleting oldest
  // (If you later add TTL index, you can remove this.)
  const count = await db.collection(MSGS).countDocuments({ roomId: id });
  if (count > 220) {
    const extra = count - 200;
    const oldest = await db
      .collection<MessageDoc>(MSGS)
      .find({ roomId: id })
      .sort({ ts: 1 })
      .limit(extra)
      .project({ _id: 1 })
      .toArray();
    if (oldest.length) {
      await db.collection(MSGS).deleteMany({ _id: { $in: oldest.map((d) => (d as any)._id) } });
    }
  }

  return res.json({ ok: true, message: { author: msg.author, text: msg.text, ts: msg.ts } });
}

// Get room state (supports polling via sinceTs)
export async function getRoomState(req: Request, res: Response) {
  const { id } = req.params;
  const sinceTs = parseSinceTs(req);

  const db = await getDb();

  const room = await db.collection<RoomDoc>(ROOMS).findOne({ _id: id });
  if (!room) return res.status(404).json({ error: 'room not found' });

  const query: any = { roomId: id };
  if (sinceTs > 0) query.ts = { $gt: sinceTs };

  const messages = await db
    .collection<MessageDoc>(MSGS)
    .find(query)
    .sort({ ts: 1 })
    .limit(50)
    .toArray();

  return res.json({
    roomId: id,
    participants: ((room as any)?.participants || []) as string[],
    messages: messages.map((m) => ({ author: m.author, text: m.text, ts: m.ts })),
  });
}

// Suggest replies
export async function suggestReplies(req: Request, res: Response) {
  const { id } = req.params;
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'text required' });

  const db = await getDb();
  const room = await db.collection<RoomDoc>(ROOMS).findOne({ _id: id });
  if (!room) return res.status(404).json({ error: 'room not found' });

  try {
    const result = await suggestService({ text });

    let variants: string[] = [];
    try {
      const candidate = String(result.reply || '')
        .replace(/```(?:\w+)?\n([\s\S]*?)```/i, '$1')
        .trim();

      const firstBracket = candidate.indexOf('[');
      const lastBracket = candidate.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        const jsonChunk = candidate.substring(firstBracket, lastBracket + 1);
        const parsed = JSON.parse(jsonChunk);
        if (Array.isArray(parsed)) {
          variants = parsed
            .map((v: any) => {
              if (v == null) return '';
              if (typeof v === 'string') return v;
              if (typeof v === 'object') return String(v.text ?? v.reply ?? v.content ?? JSON.stringify(v));
              return String(v);
            })
            .filter(Boolean)
            .slice(0, 3);
        }
      }
    } catch (e) {
      // fallback below
    }

    if (!variants.length) {
      variants = String(result.reply || '')
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3);
    }

    return res.json({ variants });
  } catch (err: any) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
