// Lightweight cross-platform fetch client used throughout the expo app.
// Provides post/get helpers, base URL handling (uses API from ./config),
// and a built-in timeout to mimic axios timeout behavior.
import { API } from './config';

type ClientResponse<T = any> = {
  data: T | null;
  status: number;
  ok: boolean;
  text: string | null;
  headers?: Headers;
};

const DEFAULT_TIMEOUT = 25000;

function buildUrl(path: string) {
  if (!path) return API;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeout = DEFAULT_TIMEOUT): Promise<ClientResponse> {
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), timeout);
  try {
    const resp = await fetch(url, { ...opts, signal: ac.signal });
    const text = await resp.text().catch(() => null);
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    return { data, status: resp.status, ok: resp.ok, text, headers: resp.headers };
  } finally {
    clearTimeout(id);
  }
}

let defaultHeaders: Record<string, string> = {};

export function setDefaultHeader(name: string, value?: string | null) {
  if (!value) {
    delete defaultHeaders[name];
    return;
  }
  defaultHeaders[name] = value;
}

const client = {
  post: async (path: string, body?: any, timeout?: number) => {
    const url = buildUrl(path);

    // If body is FormData, DO NOT set Content-Type; fetch will set correct boundary.
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;

    return await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        ...defaultHeaders,
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body == null ? undefined : (isForm ? body : JSON.stringify(body)),
    }, timeout ?? DEFAULT_TIMEOUT);
  },
  get: async (path: string, timeout?: number) => {
    const url = buildUrl(path);
    return await fetchWithTimeout(url, { method: 'GET', headers: { ...defaultHeaders } }, timeout ?? DEFAULT_TIMEOUT);
  },
  patch: async (path: string, body?: any, timeout?: number) => {
    const url = buildUrl(path);
    return await fetchWithTimeout(
      url,
      {
        method: 'PATCH',
        headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
        body: body != null ? JSON.stringify(body) : undefined,
      },
      timeout ?? DEFAULT_TIMEOUT
    );
  }
};


export default client;
