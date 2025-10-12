import { Message, IMessage } from '../models/Message';

export async function saveTurn(userId: string | undefined, role: IMessage['role'], mode: IMessage['mode'], content: string) {
  const m = new Message({ userId, role, mode, content });
  return m.save();
}

export async function getRecent(userId: string | undefined, limit = 12) {
  return Message.find(userId ? { userId } : {}).sort({ createdAt: -1 }).limit(limit).lean();
}
