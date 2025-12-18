// hooks/usePvpRoom.ts
import { useEffect, useRef, useState } from 'react';
import * as api from '../lib/api';
import type { PvpRoom } from '../types/chat';

type Msg = { name: string; text: string; ts: number };

export function usePvpRoom(initialRoomId?: string) {
  const roomIdRef = useRef<string | null>(initialRoomId ?? null);
  const lastTsRef = useRef<number>(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const [participants, setParticipants] = useState<string[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function normalizeMessages(raw: any[]): Msg[] {
    return (raw || []).map((m: any) => ({
      name: m.name || m.author || m.authorName || 'unknown',
      text: m.text || m.content || m.body || String(m),
      ts: Number(m.ts || m.ts_ms || Date.now()),
    }));
  }

  async function create() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.createPvpRoom();
      if (res?.roomId) {
        roomIdRef.current = res.roomId;
      }
      return res;
    } finally {
      setLoading(false);
    }
  }

  async function join(id: string, name?: string) {
    setLoading(true);
    setError(null);
    try {
      roomIdRef.current = id;
      const res = await api.joinPvpRoom(id, name || '');

      if (!res?.ok) {
        setError(res?.message || 'join failed');
        return res;
      }

      const normalized = normalizeMessages(res.messages || []);
      setMessages(normalized);

      const maxTs = normalized.reduce((m, x) => Math.max(m, x.ts), 0);
      lastTsRef.current = maxTs;

      const parts =
        res.participants ||
        Array.from(new Set(normalized.map((m) => m.name)));

      setParticipants(parts);

      startPolling(id);
      return res;
    } finally {
      setLoading(false);
    }
  }

  async function refresh(id: string) {
    try {
      const sinceTs = lastTsRef.current || 0;
      const s = await api.getPvpRoom(id, sinceTs);

      if ((s as any)?.participants) {
        setParticipants((s as any).participants);
      }

      const incoming = normalizeMessages((s as any)?.messages || []);
      if (!incoming.length) return;

      setMessages((prev) => [...prev, ...incoming]);

      const maxTs = incoming.reduce((m, x) => Math.max(m, x.ts), sinceTs);
      lastTsRef.current = Math.max(lastTsRef.current, maxTs);
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }

  async function postMessage(author: string, text: string) {
    const roomId = roomIdRef.current;
    if (!roomId) {
      console.warn('postMessage called without roomId');
      return;
    }

    const ts = Date.now();
    // optimistic
    setMessages((prev) => [...prev, { name: author, text, ts }]);
    lastTsRef.current = Math.max(lastTsRef.current, ts);

    try {
      await api.postPvpMessage(roomId, author, text);
    } catch (e: any) {
      setError(String(e?.message || e));
      throw e;
    }
  }

  function startPolling(id: string) {
    stopPolling();

    let cancelled = false;
    const loop = async () => {
      if (cancelled) return;
      await refresh(id);
      if (cancelled) return;
      pollingRef.current = setTimeout(loop, 5000) as any;
    };

    loop();
    return () => {
      cancelled = true;
      stopPolling();
    };
  }

  function stopPolling() {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current as any);
      pollingRef.current = null;
    }
  }

  async function translateFirst(text: string) {
    const r = await api.translateFirst(text);
    return r?.variants ?? [];
  }

  async function suggestReplies(roomId: string, lastText: string) {
    const r = await api.suggestReplies(roomId, lastText);
    return r?.variants ?? [];
  }

  useEffect(() => {
    if (!initialRoomId) return;
    roomIdRef.current = initialRoomId;
    const stop = startPolling(initialRoomId);
    return () => stop?.();
  }, [initialRoomId]);

  return {
    participants,
    messages,
    setMessages,
    error,
    loading,
    create,
    join,
    refresh,
    postMessage,
    translateFirst,
    suggestReplies,
    stopPolling,
  };
}
