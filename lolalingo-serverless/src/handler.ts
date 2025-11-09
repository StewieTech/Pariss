import type { APIGatewayProxyResult, Context } from 'aws-lambda';
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { handleChat } from '../../src/services/chat.service';
import { postTranslate } from '../../src/controllers/chat.controller';
import { createRoom, joinRoom, postMessage, getRoomState, suggestReplies } from '../../src/controllers/pvp.controller';
import { synthesize } from '../../src/services/voice.service';

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
  try {
    const parts = (name || '').split('/').filter(Boolean);
    const last = parts.length ? parts[parts.length - 1] : '';
    if (last && process.env[last]) return process.env[last];
  } catch (_) { /* ignore and fall back to SSM */ }

  const cmd = new GetParameterCommand({ Name: name, WithDecryption: withDecryption });
  try {
    const out = await ssm.send(cmd);
    return out.Parameter?.Value ?? "";
  } catch {
    return "";
  }
}

/** ===== JSON response helper (no custom CORS; Function URL adds CORS) ===== */
function json(_event: Req, statusCode: number, data: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(data)
  };
}
/** ======================================================================= */

// Single Lambda "http" entry compatible with Function URLs
export async function http(event: Req, _ctx: Context): Promise<APIGatewayProxyResult> {
  try {
    const method = event?.requestContext?.http?.method || "GET";
    const path = event?.rawPath || event?.requestContext?.http?.path || "/";

    // NOTE: With Function URL CORS enabled, AWS answers preflight before code runs.
    // Keeping this branch is harmless; it won't be called for preflight.
    if (method === "OPTIONS") {
      return {
        statusCode: 204,
        headers: {},   // no CORS here to avoid duplicates if this ever runs
        body: ""
      };
    }

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
      return json(event, 200, { ok: true, env: process.env.ENV_ALIAS || "unknown" });
    }

    if (path === "/chat/send" && method === "POST") {
      let payload: any = {};
      try {
        payload = event.body ? JSON.parse(event.body) : {};
        log('debug', 'parsed payload', { payload });
      } catch (err: any) {
        const errorId = shortId('e_parse_');
        log('error', 'payload JSON parse failed', { errorId, err: String(err), rawBody: event.body });
        return json(event, 400, { error: 'invalid JSON', details: String(err), errorId });
      }
      const envAlias = process.env.ENV_ALIAS || "staging";

      // Read OPENAI key for this env
      const keyPath = `/lola/${envAlias}/OPENAI_API_KEY`;
      const openaiKey = await getParam(keyPath, true);

      if (!openaiKey) {
        const errorId = shortId('e_ssm_');
        log('error', 'OPENAI key missing from SSM', { errorId, keyPath, envAlias });
        return json(event, 200, {
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

        return json(event, 200, {
          reply: result.reply,
          tokens: result.tokens,
          received: payload,
          envAlias,
          hasOpenAIKey: true
        });
      } catch (err: any) {
        const errorId = shortId('e_chat_');
        log('error', 'chat service error', { errorId, err: String(err) });
        return json(event, 500, { error: 'chat service failed', details: err?.message ?? String(err), errorId });
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
      try { reqLike.body = event.body ? JSON.parse(event.body) : {}; } catch { reqLike.body = {}; }
      // crude param extraction for /pvp/:id paths
      const pvpMatch = path.match(/^\/pvp\/(.+?)(?:\/|$)(.*)/);
      if (pvpMatch) {
        const maybeId = pvpMatch[1];
        reqLike.params.id = maybeId;
        reqLike._sub = pvpMatch[2] || '';
      }

      const resLike: any = {
        status: (s: number) => ({ json: (d: any) => { out = { __status: s, body: d }; } }),
        json: (d: any) => { out = d; }
      };

      await Promise.resolve(fn(reqLike, resLike));
      return out;
    }

    // /chat/translate
    if (path === '/chat/translate' && method === 'POST') {
      try {
        const envAlias = process.env.ENV_ALIAS || 'staging';
        const keyPath = `/lola/${envAlias}/OPENAI_API_KEY`;
        const openaiKey = await getParam(keyPath, true);

        if (!openaiKey) {
          const errorId = shortId('e_ssm_');
          log('error', 'OPENAI key missing from SSM for translate route', { errorId, keyPath, envAlias });
          return json(event, 200, {
            error: "OPENAI key not found in SSM for this environment",
            envAlias,
            hasOpenAIKey: false,
            errorId
          });
        }

        process.env.OPENAI_API_KEY = openaiKey;

        const result = await callController(postTranslate, event);
        if (result && result.__status) return json(event, result.__status, result.body);
        return json(event, 200, result ?? {});
      } catch (err: any) {
        const errorId = shortId('e_translate_');
        log('error', 'translate route error', { errorId, err: String(err) });
        return json(event, 500, { error: String(err), errorId });
      }
    }

    // /chat/tts -> returns binary audio (base64) from ElevenLabs
    if (path === '/chat/tts' && method === 'POST') {
      try {
        let payload: any = {};
        try { payload = event.body ? JSON.parse(event.body) : {}; } catch { payload = {}; }
        const text = String(payload?.text || payload?.input || '');
        const voiceId = String(payload?.voiceId || process.env.ELEVEN_VOICE_ID || '');

        if (!text) return json(event, 400, { error: 'missing text in request body' });

        const envAlias = process.env.ENV_ALIAS || 'staging';
        const keyPath = `/lola/${envAlias}/ELEVEN_API_KEY`;
        const elevenKey = await getParam(keyPath, true);
        if (!elevenKey) {
          const errorId = shortId('e_ssm_');
          log('error', 'ELEVEN key missing from SSM', { errorId, keyPath, envAlias });
          return json(event, 200, { error: 'ELEVEN key not found in SSM for this environment', envAlias, errorId });
        }

        process.env.ELEVEN_API_KEY = elevenKey;

        // call service
        const out = await synthesize(text, voiceId || '');
        const bodyBase64 = out.buffer.toString('base64');
        // return binary response with proper headers (no custom CORS here)
        return {
          statusCode: 200,
          headers: {
            'content-type': out.contentType,
          },
          body: bodyBase64,
          isBase64Encoded: false
        };
      } catch (err: any) {
        const errorId = shortId('e_tts_');
        log('error', 'tts route error', { errorId, err: String(err) });
        return json(event, 500, { error: 'tts failed', details: err?.message ?? String(err), errorId });
      }
    }

    // pvp routes: create, join, message, get state, suggest
    if (path.startsWith('/pvp')) {
      try {
        if (path === '/pvp/create' && method === 'POST') {
          const out = await callController(createRoom, event);
          return json(event, 200, out ?? {});
        }
        if (/^\/pvp\/[^\/]+\/join$/.test(path) && method === 'POST') {
          const out = await callController(joinRoom, event);
          return json(event, 200, out ?? {});
        }
        if (/^\/pvp\/[^\/]+\/message$/.test(path) && method === 'POST') {
          const out = await callController(postMessage, event);
          return json(event, 200, out ?? {});
        }
        if (/^\/pvp\/[^\/]+$/.test(path) && method === 'GET') {
          const out = await callController(getRoomState, event);
          return json(event, 200, out ?? {});
        }
        if (/^\/pvp\/[^\/]+\/suggest$/.test(path) && method === 'POST') {
          const out = await callController(suggestReplies, event);
          if (out && out.__status) return json(event, out.__status, out.body);
          return json(event, 200, out ?? {});
        }
      } catch (err: any) {
        return json(event, 500, { error: String(err) });
      }
    }

    return json(event, 404, { error: "Not Found", path, method });
  } catch (err: any) {
    const errorId = shortId('e_top_');
    log('error', 'Unhandled handler error', { errorId, err: String(err) });
    return json(event, 500, { error: 'internal server error', details: String(err?.message || err), errorId });
  }
}