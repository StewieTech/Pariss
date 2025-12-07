import { useState } from "react";
import client from "../lib/client";
import { API } from "../lib/config";

export async function translateButton() {
  const [isTranslating, setIsTranslating] = useState(false);
  const [text, setText] = useState('');
  const [translateOptions, setTranslateOptions] = useState<string[]>([]);

  if (!text) return;
  setIsTranslating(true); setTranslateOptions([]);
  try {
    const res = await client.post(`${API}/chat/translate`, { text });
    const variants: string[] = res?.data?.variants ?? [];
    if (Array.isArray(variants) && variants.length > 0) setTranslateOptions(variants.slice(0, 3)); else setTranslateOptions([String(res?.data?.variants || '(no variants)')]);
  } catch (e) { console.error('TranslateFirst failed', e); setTranslateOptions([`(translation failed) ${String(e)}`]); } finally { setIsTranslating(false); }
}