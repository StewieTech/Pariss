// hooks/usePvpRoom.ts
import { useEffect, useRef, useState } from 'react';
import * as api from '../lib/api';
import type { PvpRoom } from '../types/chat';

type Msg = { name: string; text: string; ts: number };

function normalizeMessages(raw: any[]): Msg[] {
  return (raw || []).map((m: any) => ({
    name: String(m?.name || m?.author || m?.authorName || 'unknown'),
    text: String(m?.text || m?.content || m?.body || ''),
    ts: Number(m?.ts || m?.ts_ms || Date.now()),
  }));
}

// Stable dedupe key
function msgKey(m: Msg) {
  return `${m.name}::${m.ts}::${m.text}`;
}


export function usePvpRoom(initialRoomId?: string) {
  const roomIdRef = useRef<string | null>(initialRoomId ?? null);
  const lastTsRef = useRef<number>(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const [participants, setParticipants] = useState<string[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.createPvpRoom();
      if (res?.roomId) {
        roomIdRef.current = res.roomId;
        lastTsRef.current = 0;
        setMessages([]);
        setParticipants([]);
      }
      return res;
    } catch (e: any) {
      setError(String(e?.message || e));
      throw e;
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
      // Replace on join (canonical history)
      setMessages(normalized);

      // participants can be from API or derived
      const parts =
        res.participants ||
        Array.from(new Set(normalized.map((m) => m.name))).filter(Boolean);

      setParticipants(parts);

      // Set lastTs to max ts in joined history
      lastTsRef.current = normalized.reduce((mx, m) => Math.max(mx, m.ts), 0);

      startPolling(id);
      return res;
    } catch (e: any) {
      setError(String(e?.message || e));
      throw e;
    } finally {
      setLoading(false);
    }
  }

  async function refresh(id: string) {
    try {
      const sinceTs = lastTsRef.current || 0;
      const s = await api.getPvpRoom(id, sinceTs);

      if ((s as any)?.participants) {
        setParticipants((s as any).participants || []);
      }

      const incoming = normalizeMessages((s as any)?.messages || []);
      if (!incoming.length) return;

      // Merge + dedupe
      setMessages((prev) => {
        const seen = new Set(prev.map(msgKey));
        const next = [...prev];

        for (const m of incoming) {
          const k = msgKey(m);
          if (!seen.has(k)) {
            seen.add(k);
            next.push(m);
          }
        }

        // Keep messages ordered by ts (optional but helps UI consistency)
        next.sort((a, b) => a.ts - b.ts);

        // Advance lastTs based on merged set
        const maxTs = next.reduce((mx, m) => Math.max(mx, m.ts), 0);
        lastTsRef.current = Math.max(lastTsRef.current, maxTs);

        return next;
      });
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

    const optimisticTs = Date.now();
    const optimisticMsg: Msg = { name: author, text, ts: optimisticTs };

    // Optimistic insert (deduped)
    setMessages((prev) => {
      const seen = new Set(prev.map(msgKey));
      const k = msgKey(optimisticMsg);
      if (seen.has(k)) return prev;
      const next = [...prev, optimisticMsg];
      next.sort((a, b) => a.ts - b.ts);
      return next;
    });

    lastTsRef.current = Math.max(lastTsRef.current, optimisticTs);

    try {
      const res = await api.postPvpMessage(roomId, author, text);

      // If server returns the canonical message (recommended), reconcile.
      const serverMsgRaw = res?.message;
      if (serverMsgRaw) {
        const serverMsg: Msg = {
          name: String(serverMsgRaw.author || serverMsgRaw.name || author),
          text: String(serverMsgRaw.text || text),
          ts: Number(serverMsgRaw.ts || optimisticTs),
        };

        setMessages((prev) => {
          // remove the optimistic one if it matches author+text and close-in-time
          const filtered = prev.filter((m) => {
            const sameAuthor = m.name === optimisticMsg.name;
            const sameText = m.text === optimisticMsg.text;
            const closeTs = Math.abs(m.ts - optimisticMsg.ts) <= 3000; // 3s window
            // drop optimistic if close match
            return !(sameAuthor && sameText && closeTs);
          });

          const seen = new Set(filtered.map(msgKey));
          const k = msgKey(serverMsg);
          const next = seen.has(k) ? filtered : [...filtered, serverMsg];
          next.sort((a, b) => a.ts - b.ts);

          const maxTs = next.reduce((mx, m) => Math.max(mx, m.ts), 0);
          lastTsRef.current = Math.max(lastTsRef.current, maxTs);

          return next;
        });
      }

      return res;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
