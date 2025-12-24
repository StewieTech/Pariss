import client from "../lib/client";
import { API } from "../lib/config";

// Option 1: pure utility function (no hooks). Caller manages state.
export async function translateFirst(text: string): Promise<string[]> {
  if (!text) return [];
  const res = await client.post(`${API}/chat/translate`, { text });
  const variants: string[] = res?.data?.variants ?? [];
  return Array.isArray(variants) ? variants : [];
}