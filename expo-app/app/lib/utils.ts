export function sanitizeVariant(raw: string) {
  if (!raw) return '';
  let s = String(raw).trim();
  // remove code fences
  s = s.replace(/```(?:\w+)?\n([\s\S]*?)```/i, '$1').trim();
  s = s.replace(/(^```|```$)/g, '').trim();
  // remove surrounding brackets if entire string is like ["a","b"]
  if (/^\[.*\]$/.test(s)) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return String(parsed[0]).trim();
      }
    } catch (e) {
      // ignore
    }
  }
  // if string is quoted, remove surrounding quotes
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  // if prefixed with labels like Casual:, remove label
  s = s.replace(/^(?:Casual:|casual:|Formal:|formal:|Playful:|playful:)\s*/i, '').trim();
  // remove stray brackets and commas
  s = s.replace(/^[\[\]\,\s]+|[\[\]\,\s]+$/g, '').trim();
  return s;
}

export default { sanitizeVariant };

export function parseRoomIdFromRaw(raw: string) {
  if (!raw) return '';
  let id = raw.trim();
  // If it looks like a URL, try to extract path parts
  if (/^https?:\/\//i.test(id)) {
    try {
      const u = new URL(id);
      const parts = u.pathname.split('/').filter(Boolean);
      const idx = parts.indexOf('pvp');
      if (idx !== -1 && parts.length > idx + 1) {
        id = parts[idx + 1];
      } else {
        id = parts[parts.length - 1] || id;
      }
    } catch {
      // fallback to sanitize
      id = id.replace(/[^a-z0-9\-_.]/ig, '');
    }
  } else {
    id = id.replace(/[^a-z0-9\-_.]/ig, '');
  }
  return id;
}
