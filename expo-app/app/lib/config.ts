export const DEFAULT_LOCAL = 'http://192.168.2.44:4000';
export const EXPO_API_URL = typeof process !== 'undefined' && (process.env as any).EXPO_API_URL ? (process.env as any).EXPO_API_URL : '';
export const API_BASE = (EXPO_API_URL && EXPO_API_URL.trim().length>0) ? EXPO_API_URL.trim() : DEFAULT_LOCAL;
export const API = API_BASE.replace(/\/$/, '');
