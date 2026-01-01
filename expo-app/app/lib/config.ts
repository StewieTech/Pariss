export const DEFAULT_LOCAL = 'http://192.168.2.44:4000';
// export const DEFAULT_LOCAL = 'http://172.20.10.2:4000';
// export const EXPO_API_URL = typeof process !== 'undefined' && (process.env as any).EXPO_API_URL ? (process.env as any).EXPO_API_URL : '';
// export const API_BASE = (EXPO_API_URL && EXPO_API_URL.trim().length>0) ? EXPO_API_URL.trim() : DEFAULT_LOCAL;
// export const API = API_BASE.replace(/\/$/, '');

// Deployed function URL (used when not running locally)
const DEFAULT_DEPLOYED = 'https://rtvfwmc7qd3p3shvzwb5pyliiy0fdvfo.lambda-url.ca-central-1.on.aws';

// Resolve API base simply: allow global override, otherwise detect runtime and pick local for local dev or deployed otherwise.
const explicit = (globalThis as any)?.EXPO_API_URL;
const isBrowserLocal = typeof globalThis !== 'undefined' && (globalThis as any).location && ['localhost', '127.0.0.1'].includes((globalThis as any).location.hostname) || ((globalThis as any).location && (globalThis as any).location.hostname?.startsWith('192.168.')) || ((globalThis as any).location && (globalThis as any).location.hostname?.startsWith('172.16.'));
export const API_BASE = explicit || (isBrowserLocal ? DEFAULT_LOCAL : DEFAULT_DEPLOYED);
export const API = `${API_BASE}`;
// log the computed API for debugging in the browser console
if (typeof console !== 'undefined') console.log('Lola Demo API base:', API_BASE);