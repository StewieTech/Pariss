import client from './client';
import { setDefaultHeader } from './client';
import type { ChatMessage, PvpRoom } from '../types/chat';

export type AppUser = {
  id: string;
  email: string;
  profile: {
    name?: string;
    gender?: 'male' | 'female' | 'nonbinary' | 'prefer_not_to_say';
    location?: string;
    learningLanguage?: string;
    photoUrl?: string;
  };
};

export function setAuthToken(token?: string | null) {
  if (!token) {
    setDefaultHeader('Authorization', null);
    return;
  }
  setDefaultHeader('Authorization', `Bearer ${token}`);
}

export async function register(email: string, password: string) {
  const res = await client.post('/auth/register', { email, password });
  return res.data as any;
}

export async function login(email: string, password: string) {
  const res = await client.post('/auth/login', { email, password });
  return res.data as any;
}

export async function getMe(): Promise<{ user: AppUser } | any> {
  const res = await client.get('/me');
  return res.data as any;
}

export async function updateProfile(patch: Partial<AppUser['profile']>) {
  const res = await client.patch('/me/profile', patch);
  return res.data as any;
}

export async function uploadProfilePhoto(uri: string) {
  const fd = new FormData();
  const filename = uri.split('/').pop() || 'profile.jpg';
  const ext = (filename.split('.').pop() || 'jpg').toLowerCase();
  const type = ext === 'png' ? 'image/png' : 'image/jpeg';

  // React Native FormData expects { uri, name, type }
  fd.append('photo', { uri, name: filename, type } as any);

  const res = await client.post('/me/photo', fd);
  return res.data as any;
}

export async function sendChatMessage(message: string, history: ChatMessage[] = []) {
  const res = await client.post('/chat/send', { message, history });
  return res.data;
}

export async function translateFirst(text: string) {
  const res = await client.post('/chat/translate', { text });
  return res.data;
}

export async function createPvpRoom() : Promise<{roomId:string, inviteUrl?:string, joinPath?:string}> {
  const res = await client.post('/pvp/create');
  return res.data;
}

export async function joinPvpRoom(roomId: string, name: string) : Promise<{ok:boolean, participants?:string[], messages?:any[], message?:string}> {
  const res = await client.post(`/pvp/${roomId}/join`, { name });
  return res.data;
}

export async function postPvpMessage(roomId: string, author: string, text: string) {
  const res = await client.post(`/pvp/${roomId}/message`, { author, text });
  return res.data;
}

export type PostPvpMessageOptions = {
  includeLola?: boolean;
  mode?: 'm1' | 'm2' | 'm3';
  clientMessageId?: string;
};

export async function postPvpMessageV2(
  roomId: string,
  author: string,
  text: string,
  options?: PostPvpMessageOptions
) {
  const res = await client.post(`/pvp/${roomId}/message`, {
    author,
    text,
    includeLola: Boolean(options?.includeLola),
    mode: options?.mode,
    clientMessageId: options?.clientMessageId,
  });
  return res.data;
}

// lib/api.ts
export async function getPvpRoom(roomId: string, sinceTs?: number) : Promise<PvpRoom> {
  const qs = typeof sinceTs === 'number' ? `?sinceTs=${encodeURIComponent(String(sinceTs))}` : '';
  const res = await client.get(`/pvp/${roomId}${qs}`);
  return res.data;
}


export async function suggestReplies(roomId: string, lastText: string) {
  const res = await client.post(`/pvp/${roomId}/suggest`, { text: lastText });
  return res.data;
}

export async function listPvpRooms(limit?: number, sinceUpdatedAt?: number) {
  const params: string[] = [];
  if (typeof limit === 'number') params.push(`limit=${encodeURIComponent(String(limit))}`);
  if (typeof sinceUpdatedAt === 'number') params.push(`sinceUpdatedAt=${encodeURIComponent(String(sinceUpdatedAt))}`);
  const qs = params.length ? `?${params.join('&')}` : '';
  const res = await client.get(`/pvp/rooms${qs}`);
  return res.data as {
    ok: boolean;
    rooms: Array<{
      roomId: string;
      createdAt: number;
      updatedAt: number;
      participantCount: number;
      participants?: string[];
      joinPath: string;
    }>;
  };
}
