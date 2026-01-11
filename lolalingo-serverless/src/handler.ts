import type { APIGatewayProxyResult, Context } from 'aws-lambda';
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { handleChat } from '../../src/services/chat.service';
import { postTranslate } from '../../src/controllers/chat.controller';
import { createRoom, joinRoom, postMessage, getRoomState, suggestReplies, listRooms } from '../../src/controllers/pvp.controller';
import { register, login } from '../../src/controllers/auth.controller';
import { getMe, patchProfile } from '../../src/controllers/me.controller';
import { synthesize } from '../../src/services/voice.service';
import { ensureIndexes } from '../../src/lib/ensureIndexes';
import { connectMongoose } from '../../src/lib/mongoose';
import jwt from 'jsonwebtoken';

type Req = {
  rawPath?: string;
  rawQueryString?: string; 
  queryStringParameters?: Record<string,string>;
  requestContext?: { http?: { method?: string; path?: string } };
  body?: string;
  headers?: Record<string, string>;
};

const ssm = new SSMClient({});

// small helper to make short traceable ids for logss
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
    // Best-effort: ensure indexes exist on cold start
    ensureIndexes().catch(() => {});

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

    // Ensure JWT_SECRET is available for auth routes
    try {
      const envAlias = process.env.ENV_ALIAS || 'staging';
      if (!process.env.JWT_SECRET) {
        const secret = await getParam(`/lola/${envAlias}/JWT_SECRET`, true);
        if (secret) process.env.JWT_SECRET = secret;
      }
    } catch {
      // auth routes will fail if missing
    }

    // Ensure MongoDB env vars are available (before connecting mongoose)
    // so connectMongoose() doesn't throw "MONGODB_URI is not set".
    try {
      const envAlias = process.env.ENV_ALIAS || "staging";
      log('debug', 'Loading MongoDB env vars from SSM', { envAlias });

      if (!process.env.MONGODB_URI) {
        const ssmPath = `/lola/${envAlias}/MONGODB_URI`;
        log('debug', 'Fetching MONGODB_URI from SSM', { ssmPath });
        const uri = await getParam(ssmPath, true);
        log('debug', 'SSM MONGODB_URI result', { 
          ssmPath, 
          found: !!uri, 
          // Show first 30 chars only (don't log full connection string with password)
          preview: uri ? uri.substring(0, 30) + '...' : '(empty)'
        });
        if (uri) process.env.MONGODB_URI = uri;
      } else {
        log('debug', 'MONGODB_URI already set in env', { 
          preview: process.env.MONGODB_URI.substring(0, 30) + '...' 
        });
      }

      if (!process.env.MONGODB_DB) {
        const ssmPath = `/lola/${envAlias}/MONGODB_DB`;
        const db = await getParam(ssmPath, false);
        log('debug', 'SSM MONGODB_DB result', { ssmPath, found: !!db, value: db || '(empty)' });
        if (db) process.env.MONGODB_DB = db;
      }
    } catch (err: any) {
      log('error', 'Failed to load MongoDB env vars from SSM', { err: String(err) });
    }

    // IMPORTANT: Await Mongoose connection so User model is ready.
    // With bufferCommands=false, queries will throw if we don't wait.
    log('debug', 'Connecting to Mongoose', { 
      hasUri: !!process.env.MONGODB_URI,
      dbName: process.env.MONGODB_DB || 'paris_dev'
    });
    try {
      await connectMongoose();
      log('debug', 'Mongoose connected successfully');
    } catch (mongoErr: any) {
      log('error', 'Mongoose connection failed', { 
        err: String(mongoErr),
        message: mongoErr?.message,
        code: mongoErr?.code
      });
      throw mongoErr;
    }

    // Ensure ElevenLabs voice id is available (optional)
    try {
      const envAlias = process.env.ENV_ALIAS || 'staging';
      if (!process.env.ELEVEN_VOICE_ID) {
        const vid = await getParam(`/lola/${envAlias}/ELEVEN_VOICE_ID`, false);
        if (vid) process.env.ELEVEN_VOICE_ID = vid;
      }
    } catch {
      // optional
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
      // This function is a thin adapter so we can reuse existing Express controllers
      // inside a Lambda Function URL.
      //
      // Express controllers expect (req, res) objects. Lambda gives us an `event`.
      // We build:
      //  - `reqLike`: looks like Express's `req` (body/query/params/headers)
      //  - `resLike`: looks like Express's `res` (status().json(), json())
      // and capture whatever the controller "responds" with into `out`.
      let out: any = undefined;
      const reqLike: any = {
        // Express-style params (used heavily by /pvp/:id routes)
        params: ({} as any),
        // Will be filled by parsing event.body
        body: undefined,
        // Express has req.query; Lambda gives queryStringParameters
            query: event.queryStringParameters || {},
        // Expose headers in a shape controllers/middleware usually expect
        headers: (event.headers || {}) as any,
        // Express has req.get('header-name')
        get: (h: string) => event.headers?.[h.toLowerCase()]
      };
      // Parse JSON body (this adapter currently supports JSON requests only)
      try { reqLike.body = event.body ? JSON.parse(event.body) : {}; } catch { reqLike.body = {}; }
      // crude param extraction for /pvp/:id paths
      const pvpMatch = path.match(/^\/pvp\/(.+?)(?:\/|$)(.*)/);
      if (pvpMatch) {
        const maybeId = pvpMatch[1];
        reqLike.params.id = maybeId;
        reqLike._sub = pvpMatch[2] || '';
      }

      // Minimal JWT auth (equivalent to requireAuth middleware)
      try {
        // Read Authorization header: "Bearer <token>"
        const h =
          (event.headers?.authorization as any) ||
          (event.headers?.Authorization as any) ||
          '';
        // Regex match returns an array; capture group 1 is the token
        const m = /^Bearer\s+(.+)$/i.exec(String(h));
        const token = m?.[1];
        if (token) {
          // JWT_SECRET must exist in the Lambda environment for auth to work
          const secret = process.env.JWT_SECRET;
          if (secret) {
            // verify() checks the signature + expiry; it does NOT just compare strings.
            const payload = jwt.verify(token, secret) as any;
            // Standard JWT user identifier is `sub` (subject). We fall back to userId if present.
            const userId = String(payload?.sub || payload?.userId || '').trim();
            // Our Express /me controllers check req.userId; attach it here
            if (userId) reqLike.userId = userId;
          }
        }
      } catch {
        // ignore here; protected controllers will respond 401 if userId missing
      }

      const resLike: any = {
        // Express controllers often do: res.status(400).json({ ... })
        // We capture both the status and the JSON body into `out`.
        status: (s: number) => ({ json: (d: any) => { out = { __status: s, body: d }; } }),
        // Or: res.json({ ... }) which implies status 200
        json: (d: any) => { out = d; }
      };

      await Promise.resolve(fn(reqLike, resLike));
      return out;
    }

    // ===== Auth/Profile routes =====
    if (path === '/auth/register' && method === 'POST') {
      const out = await callController(register, event);
      if (out && out.__status) return json(event, out.__status, out.body);
      return json(event, 200, out ?? {});
    }

    if (path === '/auth/login' && method === 'POST') {
      const out = await callController(login, event);
      if (out && out.__status) return json(event, out.__status, out.body);
      return json(event, 200, out ?? {});
    }

    if (path === '/me' && method === 'GET') {
      const out = await callController(getMe, event);
      if (out && out.__status) return json(event, out.__status, out.body);
      return json(event, 200, out ?? {});
    }

    if (path === '/me/profile' && method === 'PATCH') {
      const out = await callController(patchProfile, event);
      if (out && out.__status) return json(event, out.__status, out.body);
      return json(event, 200, out ?? {});
    }

    // Multipart file upload isn't supported in this handler yet (Function URL body handling + multipart parsing).
    if (path === '/me/photo' && method === 'POST') {
      return json(event, 501, {
        error: 'not implemented in serverless handler',
        message: 'Upload photo is not supported via Function URL yet. Use the Express server for /me/photo, or we can add multipart parsing here.'
      });
    }
    // ==============================

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

        // IMPORTANT:
        // The client expects the response body to be the raw base64 string (text/plain).
        // Function URLs/APIGW base64 flags are for binary payloads; we are not returning binary here.
        return {
          statusCode: 200,
          headers: {
            'content-type': 'text/plain',
            'x-audio-content-type': out.contentType || 'audio/mpeg',
          },
          body: bodyBase64,
          isBase64Encoded: false,
        };
      } catch (err: any) {
        const errorId = shortId('e_tts_');
        log('error', 'tts route error', {
          errorId,
          message: err?.message ?? String(err),
          status: err?.status,
        });
        return json(event, err?.status || 500, {
          error: 'tts failed',
          details: err?.message ?? String(err),
          errorId,
        });
      }
    }

    // pvp routes: create, join, message, get state, suggest
    if (path.startsWith('/pvp')) {
      try {
        if (path === '/pvp/rooms' && method === 'GET') {
          const out = await callController(listRooms, event);
          if (out && out.__status) return json(event, out.__status, out.body);
          return json(event, 200, out ?? {});
        }
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