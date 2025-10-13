// Temporary in-memory message store for initial version (no Mongo required)
// Original Mongoose-based implementation (commented out):
// import { Message, IMessage } from '../models/Message';
// export async function saveTurn(userId: string | undefined, role: IMessage['role'], mode: IMessage['mode'], content: string) {
//   const m = new Message({ userId, role, mode, content });
//   return m.save();
// }
// export async function getRecent(userId: string | undefined, limit = 12) {
//   return Message.find(userId ? { userId } : {}).sort({ createdAt: -1 }).limit(limit).lean();
// }

type Stored = { userId?: string; role: 'user' | 'assistant' | 'system'; mode: string; content: string; createdAt: number };
const STORE: Stored[] = [];

export async function saveTurn(userId: string | undefined, role: 'user' | 'assistant' | 'system', mode: string, content: string) {
  STORE.push({ userId, role, mode, content, createdAt: Date.now() });
  return Promise.resolve(true);
}

export async function getRecent(userId: string | undefined, limit = 12) {
  const filtered = userId ? STORE.filter(s => s.userId === userId) : STORE.slice();
  const sorted = filtered.sort((a, b) => b.createdAt - a.createdAt);
  return Promise.resolve(sorted.slice(0, limit).map(s => ({ role: s.role, content: s.content, createdAt: s.createdAt })));
}
