import type { APIGatewayProxyResult, Context } from 'aws-lambda';
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

type Req = {
  rawPath?: string;
  requestContext?: { http?: { method?: string; path?: string } };
  body?: string;
  headers?: Record<string, string>;
};

const ssm = new SSMClient({});

async function getParam(name: string, withDecryption = true) {
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

  if (path === "/health") {
    return json(200, { ok: true, env: process.env.ENV_ALIAS || "unknown" });
  }

  if (path === "/chat/send" && method === "POST") {
    let payload: any = {};
    try { payload = event.body ? JSON.parse(event.body) : {}; } catch {}
    const envAlias = process.env.ENV_ALIAS || "staging";

    // Read OPENAI key for this env (optional for now)
    const keyPath = `/lola/${envAlias}/OPENAI_API_KEY`;
    const openaiKey = await getParam(keyPath, true);

    // Echo until you wire the real OpenAI call:
    return json(200, {
      message: "stubbed reply (replace with OpenAI call)",
      received: payload,
      envAlias,
      hasOpenAIKey: Boolean(openaiKey)
    });
  }

  return json(404, { error: "Not Found", path, method });
}
