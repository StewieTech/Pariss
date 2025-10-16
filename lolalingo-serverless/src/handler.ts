import type { APIGatewayProxyResult, Context } from 'aws-lambda';
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { handleChat } from '../../src/services/chat.service';
import { postTranslate } from '../../src/controllers/chat.controller';
import { createRoom, joinRoom, postMessage, getRoomState, suggestReplies } from '../../src/controllers/pvp.controller';

type Req = {
  rawPath?: string;
  requestContext?: { http?: { method?: string; path?: string } };
  body?: string;
  headers?: Record<string, string>;
};

const ssm = new SSMClient({});
// small helper to make short traceable ids for logs
function shortId(prefix = '') {
  return prefix + Math.random().toString(36).slice(2, 9);
}

function log(level: 'info' | 'error' | 'debug', message: string, meta?: Record<string, any>) {
  const entry = { ts: new Date().toISOString(), level, message, ...meta };
  if (level === 'error') console.error(JSON.stringify(entry)); else console.log(JSON.stringify(entry));
}

async function getParam(name: string, withDecryption = true) {
  // allow local override via env for quick testing
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const cmd = new GetParameterCommand({ Name: name, WithDecryption: withDecryption });
  try {
    const out = await ssm.send(cmd);
    return out.Parameter?.Value ?? "";
  } catch {
    return "";
  }
}

function json(statusCode: number, data: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "*"
    },
    body: JSON.stringify(data)
  };
}

// Single Lambda "http" entry compatible with Function URLs
export async function http(event: Req, _ctx: Context): Promise<APIGatewayProxyResult> {
  const method = event?.requestContext?.http?.method || "GET";
  const path = event?.rawPath || event?.requestContext?.http?.path || "/";

  if (method === "OPTIONS") return json(204, {});

  // Ensure OPENAI key is available for all routes by reading SSM for the current env alias
  try {
    const envAlias = process.env.ENV_ALIAS || 'staging';
    const keyPath = `/lola/${envAlias}/OPENAI_API_KEY`;
    if (!process.env.OPENAI_API_KEY) {
      const s = await getParam(keyPath, true);
      if (s) process.env.OPENAI_API_KEY = s;
    }
  } catch (e) {
    // ignore; controllers will handle missing key
  }

  if (path === "/health") {
    return json(200, { ok: true, env: process.env.ENV_ALIAS || "unknown" });
  }

  if (path === "/chat/send" && method === "POST") {
    let payload: any = {};
    try {
      payload = event.body ? JSON.parse(event.body) : {};
      log('debug', 'parsed payload', { payload });
    } catch (err: any) {
      const errorId = shortId('e_parse_');
      log('error', 'payload JSON parse failed', { errorId, err: String(err), rawBody: event.body });
      return json(400, { error: 'invalid JSON', details: String(err), errorId });
    }
    const envAlias = process.env.ENV_ALIAS || "staging";

    // Read OPENAI key for this env
    const keyPath = `/lola/${envAlias}/OPENAI_API_KEY`;
    const openaiKey = await getParam(keyPath, true);

    if (!openaiKey) {
      const errorId = shortId('e_ssm_');
      log('error', 'OPENAI key missing from SSM', { errorId, keyPath, envAlias });
      return json(200, {
        error: "OPENAI key not found in SSM for this environment",
        received: payload,
        envAlias,
        hasOpenAIKey: false,
        errorId
      });
    }

    // Inject key for chat service which reads process.env.OPENAI_API_KEY
    process.env.OPENAI_API_KEY = openaiKey;

    try {
      const userText = (payload && (payload.text || payload.message || payload.input)) || '';
  const mode = payload?.mode || 'm1';
  const userId = payload?.userId;

      const result = await handleChat({ userId, text: String(userText), mode });

      return json(200, {
        reply: result.reply,
        tokens: result.tokens,
        received: payload,
        envAlias,
        hasOpenAIKey: true
      });
    } catch (err: any) {
      const errorId = shortId('e_chat_');
      log('error', 'chat service error', { errorId, err: String(err) });
      return json(500, { error: 'chat service failed', details: err?.message ?? String(err), errorId });
    }
  }

  // Adapter to call existing Express-style controllers that use (req,res)
  async function callController(fn: any, event: Req) {
    let out: any = undefined;
    const reqLike: any = {
      params: ({} as any),
      body: undefined,
      query: {},
      get: (h: string) => event.headers?.[h.toLowerCase()]
    };
    // populate params from path if present (e.g. /pvp/:id/...)
    try { reqLike.body = event.body ? JSON.parse(event.body) : {}; } catch { reqLike.body = {}; }
    // crude param extraction for /pvp/:id paths
    const pvpMatch = path.match(/^\/pvp\/(.+?)(?:\/|$)(.*)/);
    if (pvpMatch) {
      const maybeId = pvpMatch[1];
      reqLike.params.id = maybeId;
      // if further subpath present, set reqLike.path
      reqLike._sub = pvpMatch[2] || '';
    }

    const resLike: any = {
      status: (s: number) => ({ json: (d: any) => { out = { __status: s, body: d }; } }),
      json: (d: any) => { out = d; }
    };

    // call and await in case controller is async
    await Promise.resolve(fn(reqLike, resLike));
    return out;
  }

  // /chat/translate
  if (path === '/chat/translate' && method === 'POST') {
    try {
      const result = await callController(postTranslate, event);
      if (result && result.__status) return json(result.__status, result.body);
      return json(200, result ?? {});
    } catch (err: any) {
      return json(500, { error: String(err) });
    }
  }

  // pvp routes: create, join, message, get state, suggest
  if (path.startsWith('/pvp')) {
    try {
      // route to specific handlers
      if (path === '/pvp/create' && method === 'POST') {
        const out = await callController(createRoom, event);
        return json(200, out ?? {});
      }
      // /pvp/:id/join
      if (/^\/pvp\/[^\/]+\/join$/.test(path) && method === 'POST') {
        const out = await callController(joinRoom, event);
        return json(200, out ?? {});
      }
      // /pvp/:id/message
      if (/^\/pvp\/[^\/]+\/message$/.test(path) && method === 'POST') {
        const out = await callController(postMessage, event);
        return json(200, out ?? {});
      }
      // GET /pvp/:id
      if (/^\/pvp\/[^\/]+$/.test(path) && method === 'GET') {
        const out = await callController(getRoomState, event);
        return json(200, out ?? {});
      }
      // /pvp/:id/suggest
      if (/^\/pvp\/[^\/]+\/suggest$/.test(path) && method === 'POST') {
        const out = await callController(suggestReplies, event);
        if (out && out.__status) return json(out.__status, out.body);
        return json(200, out ?? {});
      }
    } catch (err: any) {
      return json(500, { error: String(err) });
    }
  }

  return json(404, { error: "Not Found", path, method });
}
