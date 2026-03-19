// src/controllers/pvp.controller.ts
import { Request, Response } from 'express';
import { getDb } from '../lib/mongo';
import { handleChat } from '../services/chat.service';
import { DEFAULT_LANGUAGE, normalizeLanguage } from '../utils/language';
import OpenAI from 'openai';

// Suggest replies service
import { getSuggestions as suggestService } from '../services/suggest.service';

type MessageDoc = {
  roomId: string;
  author: string;
  text: string;
  ts: number;
  clientMessageId?: string;
  conversationId?: string;
  // Voice note fields
  type?: 'text' | 'voice';
  msgId?: string;
  durationMs?: number;
  // Reply/review fields
  replyTo?: string;
  replyType?: 'comment' | 'review';
};

type AudioDoc = {
  msgId: string;
  roomId: string;
  audioBase64: string;
  audioContentType: string;
  ts: number;
};

type RoomDoc = {
  _id: string;
  createdAt: number;
  updatedAt: number;
  participants?: string[];
  participantActivity?: Record<string, number>; // { name: lastActivityTs }
  displayName?: string;
};

// Participants inactive for >3 days are excluded from the list
const PARTICIPANT_EXPIRY_MS = 3 * 24 * 60 * 60 * 1000;
// Rooms not used for >7 days are hidden from listings
const ROOM_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/** Return only participants active within the last 3 days */
function getActiveParticipants(room: any): string[] {
  const activity: Record<string, number> = (room as any)?.participantActivity || {};
  const cutoff = Date.now() - PARTICIPANT_EXPIRY_MS;
  const allNames: string[] = Array.isArray((room as any)?.participants) ? (room as any).participants : [];
  // If activity map exists, use it for filtering; otherwise fall back to full list
  if (Object.keys(activity).length === 0) return allNames;
  return allNames.filter(name => (activity[name] || 0) >= cutoff);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

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
const AUDIO = 'pvp_audio';

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
  return res.json({ roomId: id, joinPath: `/pvp/${id}`, displayName: '' });
}

// List rooms (backend-driven active rooms)
// GET /pvp/rooms?limit=20&sinceUpdatedAt=...ms
export async function listRooms(req: Request, res: Response) {
  try {
    const db = await getDb();
    const limit = parseLimit(req);
    const sinceUpdatedAt = parseSinceUpdatedAt(req);

    const roomExpiryCutoff = Date.now() - ROOM_EXPIRY_MS;
    const query: any = { updatedAt: { $gt: roomExpiryCutoff } };
    if (sinceUpdatedAt > 0) query.updatedAt = { $gt: Math.max(sinceUpdatedAt, roomExpiryCutoff) };

    const rooms = await db
      .collection<RoomDoc>(ROOMS)
      .find(query)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();

    return res.json({
      ok: true,
      rooms: rooms.map((r) => {
        const active = getActiveParticipants(r);
        return {
          roomId: r._id,
          displayName: (r as any).displayName || '',
          createdAt: Number((r as any).createdAt || 0),
          updatedAt: Number((r as any).updatedAt || 0),
          participantCount: active.length,
          participants: active.slice(0, 50),
          joinPath: `/pvp/${r._id}`,
        };
      }),
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

  const joinNow = Date.now();
  await db.collection<RoomDoc>(ROOMS).updateOne(
    { _id: id },
    {
      $addToSet: { participants: author },
      $set: { updatedAt: joinNow, [`participantActivity.${author}`]: joinNow },
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
    displayName: (updatedRoom as any)?.displayName || '',
    participants: getActiveParticipants(updatedRoom),
    messages: messages.map((m) => ({
      author: m.author, text: m.text, ts: m.ts,
      ...(m.type === 'voice' ? { type: 'voice', msgId: m.msgId, durationMs: m.durationMs } : {}),
      ...(m.replyTo ? { replyTo: m.replyTo, replyType: m.replyType } : {}),
      ...(m.msgId ? { msgId: m.msgId } : {}),
    })),
  });
}

// Post a message
export async function postMessage(req: Request, res: Response) {
  const { id } = req.params;

  // accept both author and name (your client sends author)
  const author = String(req.body?.author || req.body?.name || '').trim();
  const text = String(req.body?.text || '').trim();

  // Optional Lola behavior
  const includeLola = Boolean(req.body?.includeLola);
  const mode = (req.body?.mode as any) || 'm1';
  const clientMessageId = String(req.body?.clientMessageId || '').trim() || undefined;
  const conversationId = String(req.body?.conversationId || '').trim() || undefined;
  const language = normalizeLanguage(req.body?.language || DEFAULT_LANGUAGE);

  if (!author || !text) return res.status(400).json({ error: 'author/name and text required' });

  const db = await getDb();

  const room = await db.collection<RoomDoc>(ROOMS).findOne({ _id: id });
  if (!room) return res.status(404).json({ error: 'room not found' });

  // Best-effort idempotency: if a clientMessageId is supplied and already exists, return ok.
  if (clientMessageId) {
    const existing = await db.collection<MessageDoc>(MSGS).findOne({ roomId: id, clientMessageId });
    if (existing) {
      return res.json({
        ok: true,
        deduped: true,
        message: { author: existing.author, text: existing.text, ts: existing.ts },
      });
    }
  }

  const msg: MessageDoc = {
    roomId: id,
    author: author,
    text,
    ts: Date.now(),
    clientMessageId,
    conversationId,
  };

  await db.collection<MessageDoc>(MSGS).insertOne(msg);

  // keep room updated + add participant if new
  const msgNow = Date.now();
  await db.collection<RoomDoc>(ROOMS).updateOne(
    { _id: id },
    {
      $addToSet: { participants: author },
      $set: { updatedAt: msgNow, [`participantActivity.${author}`]: msgNow },
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

  const out: any = { ok: true, message: { author: msg.author, text: msg.text, ts: msg.ts } };

  if (includeLola) {
    try {
      // Build short room history for Lola context (last 12 messages)
      const recent = await db
        .collection<MessageDoc>(MSGS)
        .find(conversationId ? { roomId: id, conversationId } : { roomId: id })
        .sort({ ts: -1 })
        .limit(12)
        .toArray();

      // Convert to a compact context string. (You said you'll tune prompts later.)
      const contextLines = [...recent]
        .reverse()
        .map((m) => `${m.author}: ${m.text}`)
        .join('\n');

      const lolaInput = `Room ${id} conversation so far:\n${contextLines}\n\nUser (${author}) just said: ${text}`;

      // Use room id as userId so message.repo history is room-scoped (simple, no schema change there)
      const result = await handleChat({
        userId: `room:${id}`,
        conversationId,
        text: lolaInput,
        mode,
        language,
      });
      const replyText = String(result?.reply || '').trim() || 'Sorry, no reply.';

      const lolaMsg: MessageDoc = {
        roomId: id,
        author: 'Lola',
        text: replyText,
        ts: Date.now(),
        conversationId,
      };

      await db.collection<MessageDoc>(MSGS).insertOne(lolaMsg);

      // bump room updatedAt for bot activity too
      await db.collection<RoomDoc>(ROOMS).updateOne(
        { _id: id },
        { $set: { updatedAt: Date.now() } }
      );

      out.lola = { author: lolaMsg.author, text: lolaMsg.text, ts: lolaMsg.ts };
    } catch (err: any) {
      // Don't fail the user's send; return ok with error detail.
      out.lolaError = String(err?.message || err);
    }
  }

  return res.json(out);
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

  // If room hasn't been used in 7 days, treat it as expired
  const roomExpired = (room.updatedAt || 0) < Date.now() - ROOM_EXPIRY_MS;
  if (roomExpired) {
    return res.json({
      roomId: id,
      expired: true,
      displayName: (room as any)?.displayName || '',
      participants: [],
      messages: [],
    });
  }

  return res.json({
    roomId: id,
    displayName: (room as any)?.displayName || '',
    participants: getActiveParticipants(room),
    messages: messages.map((m) => ({
      author: m.author, text: m.text, ts: m.ts,
      ...(m.type === 'voice' ? { type: 'voice', msgId: m.msgId, durationMs: m.durationMs } : {}),
      ...(m.replyTo ? { replyTo: m.replyTo, replyType: m.replyType } : {}),
      ...(m.msgId ? { msgId: m.msgId } : {}),
    })),
  });
}

// Rename a room (set custom displayName)
export async function renameRoom(req: Request, res: Response) {
  const { id } = req.params;
  const rawName = String(req.body?.displayName || '').trim();
  if (!rawName) return res.status(400).json({ error: 'displayName required' });

  const db = await getDb();
  const room = await db.collection<RoomDoc>(ROOMS).findOne({ _id: id });
  if (!room) return res.status(404).json({ error: 'room not found' });

  const displayName = rawName.slice(0, 80);
  const slug = slugify(displayName);

  await db.collection<RoomDoc>(ROOMS).updateOne(
    { _id: id },
    { $set: { displayName, updatedAt: Date.now() } }
  );

  return res.json({
    ok: true,
    roomId: id,
    displayName,
    slug,
    shareUrl: `/${id}/${slug}`,
  });
}

// Post a voice message
export async function postVoiceMessage(req: Request, res: Response) {
  const { id } = req.params;
  const author = String(req.body?.author || req.body?.name || '').trim();
  const audioBase64 = String(req.body?.audioBase64 || '').trim();
  const mimeType = String(req.body?.mimeType || 'audio/webm').trim();
  const language = normalizeLanguage(req.body?.language || DEFAULT_LANGUAGE);
  const durationMs = Number(req.body?.durationMs || 0);
  const replyTo = String(req.body?.replyTo || '').trim() || undefined;
  const replyType = (req.body?.replyType as 'comment' | 'review') || (replyTo ? 'review' : undefined);

  if (!author) return res.status(400).json({ error: 'author/name required' });
  if (!audioBase64) return res.status(400).json({ error: 'audioBase64 required' });

  const db = await getDb();
  const room = await db.collection<RoomDoc>(ROOMS).findOne({ _id: id });
  if (!room) return res.status(404).json({ error: 'room not found' });

  // Transcribe audio with Whisper
  let transcript = '';
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY not set');
    const oai = new OpenAI({ apiKey: key });

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : 'webm';
    const file = new File([audioBuffer], `voice.${ext}`, { type: mimeType });

    const sttResp = await oai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      language: language === 'french' ? 'fr' : language === 'spanish' ? 'es' : language === 'german' ? 'de' : language === 'japanese' ? 'ja' : undefined,
    });
    transcript = sttResp.text || '';
  } catch (err: any) {
    console.warn('Voice note transcription failed:', String(err?.message || err));
    transcript = '(voice note)';
  }

  const msgId = `vn_${Date.now()}_${makeId(8)}`;
  const ts = Date.now();

  // Store message doc (without audio)
  const msg: MessageDoc = {
    roomId: id,
    author,
    text: transcript,
    ts,
    type: 'voice',
    msgId,
    durationMs: durationMs || undefined,
    replyTo,
    replyType,
  };
  await db.collection<MessageDoc>(MSGS).insertOne(msg);

  // Store audio separately
  const audioDoc: AudioDoc = {
    msgId,
    roomId: id,
    audioBase64,
    audioContentType: mimeType,
    ts,
  };
  await db.collection<AudioDoc>(AUDIO).insertOne(audioDoc);

  // Update room
  await db.collection<RoomDoc>(ROOMS).updateOne(
    { _id: id },
    { $addToSet: { participants: author }, $set: { updatedAt: ts, [`participantActivity.${author}`]: ts } }
  );

  return res.json({
    ok: true,
    message: {
      author, text: transcript, ts, type: 'voice', msgId,
      durationMs: durationMs || undefined,
      replyTo, replyType,
    },
  });
}

// Fetch audio for a voice message
export async function getAudio(req: Request, res: Response) {
  const { msgId } = req.params;
  if (!msgId) return res.status(400).json({ error: 'msgId required' });

  const db = await getDb();
  const audio = await db.collection<AudioDoc>(AUDIO).findOne({ msgId });
  if (!audio) return res.status(404).json({ error: 'audio not found' });

  return res.json({
    msgId: audio.msgId,
    audioBase64: audio.audioBase64,
    audioContentType: audio.audioContentType,
  });
}

// Generate a suggested phrase for voice note practice
export async function generateVoiceSuggestion(req: Request, res: Response) {
  const lastMessage = String(req.body?.lastMessage || '').trim();
  const language = normalizeLanguage(req.body?.language || DEFAULT_LANGUAGE);

  if (!lastMessage) return res.status(400).json({ error: 'lastMessage required' });

  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY not set');
    const oai = new OpenAI({ apiKey: key });

    const langLabel = language.charAt(0).toUpperCase() + language.slice(1);
    const resp = await oai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a language practice assistant. Given Lola's last message in ${langLabel}, suggest a short natural reply the student should say in ${langLabel}. Return ONLY the ${langLabel} phrase, nothing else. Keep it 3-10 words.`,
        },
        { role: 'user', content: `Lola said: "${lastMessage}"\nSuggest what the student should say back in ${langLabel}:` },
      ],
      temperature: 0.7,
      max_tokens: 60,
    });

    const suggestion = String(resp?.choices?.[0]?.message?.content || '').trim();
    return res.json({ suggestion });
  } catch (err: any) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
}

// Suggest replies
export async function suggestReplies(req: Request, res: Response) {
  const { id } = req.params;
  const text = String(req.body?.text || '').trim();
  const language = normalizeLanguage(req.body?.language || DEFAULT_LANGUAGE);
  if (!text) return res.status(400).json({ error: 'text required' });

  const db = await getDb();
  const room = await db.collection<RoomDoc>(ROOMS).findOne({ _id: id });
  if (!room) return res.status(404).json({ error: 'room not found' });

  try {
    const result = await suggestService({ text, language });

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
