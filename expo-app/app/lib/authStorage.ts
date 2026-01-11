import { Platform } from 'react-native';

// SecureStore is best on native, but it isn't available on web.
let SecureStore: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SecureStore = require('expo-secure-store');
} catch {
  SecureStore = null;
}

const KEY = 'lola_auth_token';

export async function getToken(): Promise<string | null> {
  try {
    if (Platform.OS !== 'web' && SecureStore?.getItemAsync) {
      return await SecureStore.getItemAsync(KEY);
    }
    if (typeof localStorage !== 'undefined') return localStorage.getItem(KEY);
    return null;
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  if (!token) return;
  try {
    if (Platform.OS !== 'web' && SecureStore?.setItemAsync) {
      await SecureStore.setItemAsync(KEY, token);
      return;
    }
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, token);
  } catch {
    // ignore
  }
}

export async function clearToken(): Promise<void> {
  try {
    if (Platform.OS !== 'web' && SecureStore?.deleteItemAsync) {
      await SecureStore.deleteItemAsync(KEY);
      return;
    }
    if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
