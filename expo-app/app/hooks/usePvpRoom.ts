import { useEffect, useRef, useState } from 'react';
import * as api from '../lib/api';
import type { PvpRoom } from '../types/chat';

export function usePvpRoom(roomId?: string) {
  const [room] = useState<PvpRoom | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [messages, setMessages] = useState<{ name:string; text:string; ts:number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const polling = useRef<NodeJS.Timeout | null>(null);

  function normalizeMessages(raw:any[]): { name:string; text:string; ts:number }[] {
    return (raw||[]).map((m:any)=>({ name: m.name || m.author || m.authorName || 'unknown', text: m.text || m.content || m.body || String(m), ts: m.ts || m.ts_ms || Date.now() }));
  }

  async function create() {
    setError(null); setLoading(true);
    try {
      const res = await api.createPvpRoom();
      return res;
    } catch(e:any){ setError(String(e?.message||e)); throw e; } finally { setLoading(false); }
  }

  async function join(id: string, name?: string) {
    setError(null); setLoading(true);
    try {
      const res = await api.joinPvpRoom(id, name||'');
      if (!res?.ok) { setError(res?.message || 'join failed'); return res; }
      // populate local state
      const parts = res.participants || (Array.isArray(res.messages) ? Array.from(new Set((res.messages||[]).map((m:any)=>m.author || m.name).filter(Boolean))) : []);
      setParticipants(parts || []);
      setMessages(normalizeMessages(res.messages || []));
      // start polling loop
      startPolling(id);
      return res;
    } catch(e:any){ setError(String(e?.message||e)); throw e; } finally { setLoading(false); }
  }

  async function refresh(id: string) {
    try {
      const s = await api.getPvpRoom(id);
      let parts: string[] = [];
      let msgs: any[] = [];
      if (s && (s as any).participants) {
        parts = (s as any).participants;
      } else if (s && Array.isArray((s as any).messages)) {
        parts = Array.from(new Set(((s as any).messages||[]).map((m:any)=>m.author || m.name).filter(Boolean)));
      }
      if (s && (s as any).messages) msgs = (s as any).messages;
      setParticipants(parts || []);
      setMessages(normalizeMessages(msgs||[]));
    } catch (e:any) { setError(String(e?.message || e)); }
  }

  async function postMessage(author: string, text: string) {
    if (!room) return;
    try {
      const res = await api.postPvpMessage(room.id, author, text);
      // optimistic update
      const msg = res?.message ? res.message : { name: author, text, ts: Date.now() };
      setMessages(m => [...m, { name: msg.name || author, text: msg.text || text, ts: msg.ts || Date.now() }]);
      return res;
    } catch(e:any){ setError(String(e?.message||e)); throw e; }
  }

  function startPolling(id: string) {
    if (polling.current) clearTimeout(polling.current as any);
    let cancelled = false;
    (async function loop(){
      try{ await refresh(id); } catch(e){ console.warn('poll error', e); }
      if (cancelled) return;
      polling.current = setTimeout(loop, 3000) as any;
    })();
    return ()=>{ cancelled=true; if (polling.current) clearTimeout(polling.current as any); };
  }

  function stopPolling() { if (polling.current) { clearTimeout(polling.current as any); polling.current = null; } }

  async function translateFirst(text: string) {
    const r = await api.translateFirst(text);
    return r?.variants ?? [];
  }

  async function suggestReplies(roomId: string, lastText: string) {
    const r = await api.suggestReplies(roomId, lastText);
    return r?.variants ?? [];
  }

  useEffect(()=>{
    if (!roomId) return;
    // start polling for this external roomId
    const stop = startPolling(roomId);
    return ()=>{ stop(); };
  }, [roomId]);

  return { room, participants, messages, error, loading, create, join, refresh, postMessage, translateFirst, suggestReplies, stopPolling };
}
