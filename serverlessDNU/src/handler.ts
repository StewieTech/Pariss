import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssm = new SSMClient({});

async function getOpenAIKey(env: string) {
  try {
    const name = `/lola/${env}/OPENAI_API_KEY`;
    const out = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
    return out.Parameter?.Value ?? null;
  } catch (e) {
    // mock ok - return null
    return null;
  }
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const path = event.rawPath || event.requestContext.http.path || '/';
  const env = process.env.STAGE || 'preprod';

  if (path === '/health' || (event.requestContext.http.method === 'GET' && path === '/')) {
    return { statusCode: 200, body: JSON.stringify({ status: 'ok', env }) };
  }

  if (path === '/chat/send' && event.requestContext.http.method === 'POST') {
    const body = event.body ? JSON.parse(event.body) : {};
    // echo
    return { statusCode: 200, body: JSON.stringify({ echo: body, env }) };
  }

  return { statusCode: 404, body: JSON.stringify({ error: 'not found' }) };
};
