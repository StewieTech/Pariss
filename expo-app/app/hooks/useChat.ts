import { useState } from 'react';
import type { ChatMessage } from '../types/chat';
import * as api from '../lib/api';

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  async function send(text: string) {
    const userMsg: ChatMessage = { author: 'user', text, timestamp: Date.now() };
    setMessages(m => [...m, userMsg]);
    setLoading(true);
    try {
      const resp = await api.sendChatMessage(text, messages);
      const botText = resp?.reply || resp?.message || (Array.isArray(resp) ? resp[0] : '');
      const botMsg: ChatMessage = { author: 'bot', text: String(botText), timestamp: Date.now() };
      setMessages(m => [...m, botMsg]);
      return botMsg;
    } finally {
      setLoading(false);
    }
  }

  async function translate(text: string) {
    setLoading(true);
    try {
      const resp = await api.translateFirst(text);
      return resp;
    } finally { setLoading(false); }
  }

  return { messages, loading, send, translate, setMessages };
}
