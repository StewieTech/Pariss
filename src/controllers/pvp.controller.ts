import { Request, Response } from 'express';

type Message = { name: string; text: string; ts: number };

type Room = {
  id: string;
  createdAt: number;
  participants: Set<string>;
  messages: Message[];
};

const rooms = new Map<string, Room>();

function makeId(len = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// cleanup old rooms every hour
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms.entries()) {
    if (now - room.createdAt > 1000 * 60 * 60 * 24) {
      rooms.delete(id);
    }
  }
}, 1000 * 60 * 60);

export function createRoom(req: Request, res: Response) {
  const id = makeId();
  const room: Room = { id, createdAt: Date.now(), participants: new Set(), messages: [] };
  rooms.set(id, room);
  // return a simple shareable path
  return res.json({ roomId: id, joinPath: `/pvp/${id}` });
}

export function joinRoom(req: Request, res: Response) {
  const { id } = req.params;
  const { name } = req.body || {};
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' });
  const room = rooms.get(id);
  if (!room) return res.status(404).json({ error: 'room not found' });
  room.participants.add(name.trim());
  return res.json({ roomId: id, participants: Array.from(room.participants), messages: room.messages });
}

export function postMessage(req: Request, res: Response) {
  const { id } = req.params;
  const { name, text } = req.body || {};
  if (!name || !text) return res.status(400).json({ error: 'name and text required' });
  const room = rooms.get(id);
  if (!room) return res.status(404).json({ error: 'room not found' });
  const msg: Message = { name: String(name).trim(), text: String(text), ts: Date.now() };
  room.messages.push(msg);
  // Keep messages bounded
  if (room.messages.length > 200) room.messages.shift();
  return res.json({ ok: true, message: msg });
}

export function getRoomState(req: Request, res: Response) {
  const { id } = req.params;
  const room = rooms.get(id);
  if (!room) return res.status(404).json({ error: 'room not found' });
  return res.json({ roomId: id, participants: Array.from(room.participants), messages: room.messages });
}

// Suggest replies for a message within a room (uses dedicated suggest service)
import { getSuggestions as suggestService } from '../services/suggest.service';

export async function suggestReplies(req: Request, res: Response) {
  const { id } = req.params;
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required' });
  const room = rooms.get(id);
  if (!room) return res.status(404).json({ error: 'room not found' });
  try {
    const result = await suggestService({ text });
    // try parse JSON array
    let variants: string[] = [];
    try {
      const candidate = String(result.reply || '').replace(/```(?:\w+)?\n([\s\S]*?)```/i, '$1').trim();
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
    } catch (e) {
      console.warn('suggest parsing fallback', e);
      // fallback: split lines
      variants = String(result.reply).split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0,3);
    }
    return res.json({ variants });
  } catch (err: any) {
    return res.status(500).json({ error: String(err) });
  }
}
