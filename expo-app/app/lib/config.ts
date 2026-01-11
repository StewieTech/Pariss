// expo-app/app/lib/config.ts
import Constants from 'expo-constants';

export const DEFAULT_LOCAL = 'http://192.168.2.44:4000';
const DEFAULT_DEPLOYED = 'https://rtvfwmc7qd3p3shvzwb5pyliiy0fdvfo.lambda-url.ca-central-1.on.aws';

// Read from expoConfig.extra (populated by app.config.js).
// Falls back to process.env for legacy/direct bundler support.
const extra = Constants.expoConfig?.extra ?? {};

const PUBLIC_URL: string | undefined =
  extra.EXPO_PUBLIC_API_URL || (process.env as any)?.EXPO_PUBLIC_API_URL;
const LEGACY_URL: string | undefined =
  extra.EXPO_API_URL || (process.env as any)?.EXPO_API_URL;

export const envUrl: string | undefined = PUBLIC_URL || LEGACY_URL;

const isBrowserLocal = (() => {
  const loc = (globalThis as any)?.location;
  const host = (loc?.hostname as string | undefined) || '';
  if (!host) return false;
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('192.168.') ||
    host.startsWith('172.16.') ||
    host.startsWith('10.')
  );
})();

const trimmedEnvUrl = (envUrl || '').trim();

export const API_BASE = trimmedEnvUrl || (isBrowserLocal ? DEFAULT_LOCAL : DEFAULT_DEPLOYED);
export const API = API_BASE.replace(/\/$/, '');

if (typeof console !== 'undefined') {
  console.log('Lola config.extra:', JSON.stringify(extra));
  console.log('Lola Demo API env (EXPO_PUBLIC_API_URL):', PUBLIC_URL);
  console.log('Lola Demo API env (EXPO_API_URL):', LEGACY_URL);
  console.log('Lola Demo API resolved API_BASE:', API_BASE);
}

if (!trimmedEnvUrl && !isBrowserLocal) {
  // This is what you WANT for exported builds: fail fast if not configured
  // so you don't ship a build pointing at the wrong backend.
  console.warn(
    'Missing EXPO_PUBLIC_API_URL (and EXPO_API_URL). Falling back to DEFAULT_DEPLOYED:',
    DEFAULT_DEPLOYED
  );
}