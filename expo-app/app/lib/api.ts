import client from './client';
import { setDefaultHeader } from './client';
import type { ChatMessage, PvpRoom } from '../types/chat';
import type { AppLanguage } from './languages';

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

export async function sendChatMessage(
  message: string,
  history: ChatMessage[] = [],
  language?: AppLanguage
) {
  const res = await client.post('/chat/send', { message, history, language });
  return res.data;
}

export type VoiceTurnResponse = {
  transcript: string;
  assistantText: string;
  audioBase64: string;
  audioContentType: string;
  selectedLanguage: AppLanguage;
  conversationId: string;
  timings?: {
    sttMs: number;
    llmMs: number;
    ttsMs: number;
    totalMs: number;
  };
};

export type TtsProvider = 'openai' | 'elevenlabs';

export async function sendVoiceTurn(input: {
  audioBase64: string;
  mimeType: string;
  language: AppLanguage;
  conversationId: string;
  voiceId?: string;
  ttsProvider?: TtsProvider;
}) {
  const res = await client.post(
    '/chat/voice-turn',
    {
      audioBase64: input.audioBase64,
      mimeType: input.mimeType,
      language: input.language,
      mode: 'm3',
      conversationId: input.conversationId,
      voiceId: input.voiceId,
      ttsProvider: input.ttsProvider || 'openai',
    },
    60000
  );
  return res.data as VoiceTurnResponse;
}

export async function translateFirst(text: string, language?: AppLanguage) {
  const res = await client.post('/chat/translate', { text, language });
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
  language?: AppLanguage;
  conversationId?: string;
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
    language: options?.language,
    conversationId: options?.conversationId,
  });
  return res.data;
}

// lib/api.ts
export async function getPvpRoom(roomId: string, sinceTs?: number) : Promise<PvpRoom> {
  const qs = typeof sinceTs === 'number' ? `?sinceTs=${encodeURIComponent(String(sinceTs))}` : '';
  const res = await client.get(`/pvp/${roomId}${qs}`);
  return res.data;
}


export async function suggestReplies(roomId: string, lastText: string, language?: AppLanguage) {
  const res = await client.post(`/pvp/${roomId}/suggest`, { text: lastText, language });
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
