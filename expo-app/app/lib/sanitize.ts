export function sanitizeVariant(raw: string) {
  if (!raw) return '';
  let s = String(raw).trim();
  s = s.replace(/```(?:\w+)?\n([\s\S]*?)```/i, '$1').trim();
  s = s.replace(/(^```|```$)/g, '').trim();
  if (/^\[.*\]$/.test(s)) {
    try { const parsed = JSON.parse(s); if (Array.isArray(parsed) && parsed.length>0) return String(parsed[0]).trim(); } catch(e){}
  }
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1,-1).trim();
  s = s.replace(/^(?:Casual:|casual:|Formal:|formal:|Playful:|playful:)\s*/i, '').trim();
  s = s.replace(/^[\[\]\,\s]+|[\[\]\,\s]+$/g, '').trim();
  return s;
}
