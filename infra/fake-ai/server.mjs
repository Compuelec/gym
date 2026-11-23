// Fake Claude API for the e2e stack (never used in production). Accepts one key, answers the
// Models API, and returns scripted structured outputs for the coach (User Story 6).
import { createServer } from 'node:http';

const VALID_KEY = process.env.FAKE_AI_KEY ?? 'sk-ant-fake-valid-key-for-e2e-tests-wxyz';
const calls = [];

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function authorized(req) {
  // Current SDKs send `Authorization: Bearer <key>`; older ones `x-api-key`.
  return req.headers['x-api-key'] === VALID_KEY || req.headers.authorization === `Bearer ${VALID_KEY}`;
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

/** Picks a scripted reply: the test controls it through markers in the user's message. */
export function reply(body) {
  const text = JSON.stringify([body.system ?? [], body.messages ?? []]);
  // Catalog lines look like «fedb:Id|Nombre|…»: take ids from there (sorted, deterministic).
  const catalogIds = [...text.matchAll(/(fedb:[A-Za-z0-9_.-]+)\|/g)].map((m) => m[1]);
  const usage = { input_tokens: 4000, output_tokens: 1500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  if (text.includes('[[REFUSE]]')) return { stop_reason: 'refusal', content: [], usage };
  if (text.includes('[[SLOW]]')) return { delayMs: 200_000 };
  if (text.includes('[[ERROR500]]')) return { status: 500 };
  const weekly = text.includes('revisión semanal');
  const pick = (n) => [...new Set(catalogIds)].slice(0, n);
  const out = weekly
    ? { highlightsEs: ['Entrenaste 3 días esta semana.'], concernsEs: [], adjustments: [] }
    : {
        name: 'Fuerza en casa',
        // [[LONG]]: texts over the schema limits (600 / 400 chars), as the real model sometimes writes.
        summaryEs: text.includes('[[LONG]]')
          ? 'Programa de 4 semanas con mancuernas, 3 días por semana. '.repeat(15)
          : 'Programa de 4 semanas con mancuernas, 3 días por semana.',
        weeks: 4,
        progressionNoteEs: text.includes('[[LONG]]')
          ? 'Sube el peso cuando completes todas las repeticiones. '.repeat(12)
          : 'Sube el peso cuando completes todas las repeticiones.',
        days: [1, 2, 3].map((dayIndex, d) => ({
          dayIndex,
          title: `Día ${dayIndex}`,
          locationId: (text.match(/"locationId":"([0-9a-f-]{36})"/) ?? text.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/))?.[1] ?? '',
          items: [
            ...pick(3 + d).slice(d, d + 3).map((exerciseId) => ({ exerciseId, sets: 3, repMin: 8, repMax: 12, seconds: null, rir: 2, restSeconds: 90, supersetGroup: null, noteEs: null })),
            ...(text.includes('[[INVENT]]') ? [{ exerciseId: 'fedb:Inventado', sets: 3, repMin: 8, repMax: 12, seconds: null, rir: 2, restSeconds: 90, supersetGroup: null, noteEs: null }] : []),
          ],
        })),
        safetyNoteEs: null,
      };
  return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(out) }], usage };
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/__calls') return send(res, 200, { calls });
  if (url.pathname.startsWith('/v1/models/') && req.method === 'GET') {
    if (!authorized(req)) return send(res, 401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
    return send(res, 200, { type: 'model', id: url.pathname.split('/').pop(), display_name: 'Fake', created_at: '2026-01-01T00:00:00Z' });
  }
  if (url.pathname === '/v1/messages' && req.method === 'POST') {
    if (!authorized(req)) return send(res, 401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
    const body = await readBody(req);
    calls.push({ model: body.model, at: new Date().toISOString() });
    const r = reply(body);
    if (r.status) return send(res, r.status, { type: 'error', error: { type: 'api_error', message: 'boom' } });
    if (r.delayMs) await new Promise((resolve) => setTimeout(resolve, r.delayMs));
    return send(res, 200, { id: `msg_${calls.length}`, type: 'message', role: 'assistant', model: body.model, content: r.content, stop_reason: r.stop_reason, stop_sequence: null, usage: r.usage });
  }
  send(res, 404, { type: 'error', error: { type: 'not_found_error', message: 'not found' } });
}).listen(4010, () => console.log('fake AI on :4010'));
