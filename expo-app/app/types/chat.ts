export type ChatMessage = {
  id?: string;
  author: 'user'|'bot'|string;
  text: string;
  timestamp?: number;
}

export type PvpMessage = {
  id?: string;
  author: string;
  text: string;
  ts?: number;
}

export type PvpRoom = {
  id: string;
  messages: PvpMessage[];
  createdAt: number;
}
