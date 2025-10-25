// Server-side voice service that calls ElevenLabs TTS and returns audio bytes.
// This runs in Node (Lambda) and expects ELEVEN_API_KEY to be available in process.env.
export async function synthesize(text: string, voiceId: string): Promise<{ buffer: Buffer; contentType: string }> {
  if (!text) throw new Error('text required');
  const apiKey = process.env.ELEVEN_API_KEY;
  if (!apiKey) throw new Error('ELEVEN_API_KEY not set in environment');

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({ text }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '[no body]');
    const err = new Error(`ElevenLabs TTS failed: ${resp.status} ${String(body).slice(0,200)}`);
    (err as any).status = resp.status;
    (err as any).body = body;
    throw err;
  }

  const ab = await resp.arrayBuffer();
  const buf = Buffer.from(ab);
  const contentType = resp.headers.get('content-type') || 'application/octet-stream';
  return { buffer: buf, contentType };
}

export default { synthesize };
