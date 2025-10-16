import axios from 'axios';
import { API } from './config';
import type { ChatMessage, PvpRoom } from '../types/chat';

const client = axios.create({ baseURL: API, timeout: 25000 });

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

export async function getPvpRoom(roomId: string) : Promise<PvpRoom> {
  const res = await client.get(`/pvp/${roomId}`);
  return res.data;
}

export async function suggestReplies(roomId: string, lastText: string) {
  const res = await client.post(`/pvp/${roomId}/suggest`, { text: lastText });
  return res.data;
}
