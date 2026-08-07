// Matches the live Dograh model pipeline to Outpero's production stack:
//   LLM: openai gpt-5-mini      -> google gemini-2.5-flash (max_tokens 160)
//   STT: sarvam saaras:v3       -> sarvam saarika:v2.5
//   TTS: cartesia sonic-3.5     -> kept (matches Outpero's cartesia tier)
//
// Reads the current org config, swaps the two LLM/STT blocks, keeps TTS, and
// PUTs it back. REQUIRES real keys in env because Dograh masks api_key on GET;
// every block's key is replaced with a real one below, so no masked value is
// ever written back (see dograh.service.ts).
//   DOGRAH_API_KEY   - our own key for the Dograh API
//   GOOGLE_API_KEY   - real Google key (for the new LLM block)
//   SARVAM_API_KEY   - real Sarvam key (for the new STT block)
//   CARTESIA_API_KEY - real Cartesia key (re-preserved into the kept TTS block)
// Safe to re-run; idempotent overwrite of the same fields.

const baseUrl = process.env.DOGRAH_API_URL || 'http://localhost:8010';
const apiKey = process.env.DOGRAH_API_KEY;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required — without the real key this would overwrite Dograh's stored credential with asterisks.`);
  return v;
}

const getRes = await fetch(`${baseUrl}/api/v1/organizations/model-configurations/v2`, {
  headers: { 'X-API-Key': apiKey },
});
if (!getRes.ok) throw new Error(`GET model config failed: ${getRes.status} ${await getRes.text()}`);
const raw = await getRes.json();
const current = raw.configuration || raw;

if (current?.mode !== 'byok' || !current.byok?.pipeline) {
  throw new Error('Org config is not in BYOK pipeline mode — this script only rewrites a byok.pipeline.');
}

const pipeline = current.byok.pipeline;

const googleKey = requireEnv('GOOGLE_API_KEY');
const sarvamKey = requireEnv('SARVAM_API_KEY');
const cartesiaKey = requireEnv('CARTESIA_API_KEY');

pipeline.llm = {
  provider: 'google',
  api_key: googleKey,
  model: 'gemini-2.5-flash',
  max_tokens: 160,
  temperature: 0.5,
};

pipeline.stt = {
  provider: 'sarvam',
  api_key: sarvamKey,
  model: 'saarika:v2.5',
  language: 'unknown',
};

// TTS kept as cartesia sonic-3.5 (matches Outpero's cartesia tier), but its
// masked key must be replaced with the real one so the round-trip preserves it.
pipeline.tts.api_key = cartesiaKey;

console.log('New pipeline:', JSON.stringify(pipeline, null, 2));

const putRes = await fetch(`${baseUrl}/api/v1/organizations/model-configurations/v2`, {
  method: 'PUT',
  headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
  body: JSON.stringify(current),
});
if (!putRes.ok) throw new Error(`PUT model config failed: ${putRes.status} ${await putRes.text()}`);
console.log('PUT status:', putRes.status, '— pipeline now matches Outpero (LLM gemini-2.5-flash, STT saarika:v2.5, TTS cartesia sonic-3.5).');
