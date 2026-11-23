/**
 * Translates the catalog to neutral Spanish with Claude and stores the result in
 * translations/es.json (reviewable, committed). Incremental: only missing entries are sent,
 * and entries marked `reviewed: true` are never touched.
 *
 *   ANTHROPIC_API_KEY=… pnpm --filter @gym/catalog translate:catalog [--limit 50]
 *
 * Cost with claude-haiku-5-5 for the whole catalog is well under 1 USD.
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { CACHE_DIR, FEDB_COMMIT, TRANSLATIONS_FILE } from '../src/config';
import { cleanSteps, type Translations } from '../src/merge';
import { FedbExerciseSchema, type FedbExercise } from '../src/sources/fedb';

const MODEL = process.env.CATALOG_TRANSLATE_MODEL ?? 'claude-haiku-5-5';
const BATCH = 12;

const OutputSchema = z.object({
  items: z.array(z.object({ id: z.string(), nameEs: z.string(), instructionsEs: z.array(z.string()) })),
});

const SYSTEM = `Traduces fichas de ejercicios de gimnasio del inglés al español neutro (Latinoamérica).
Reglas:
- Usa la terminología habitual de gimnasio: press de banca, sentadilla, peso muerto, dominadas,
  remo, jalón al pecho, curl de bíceps, fondos, zancadas, plancha, elevaciones laterales, polea,
  mancuernas, barra, barra Z, kettlebell, banda elástica, balón medicinal.
- Nombres: breves, sin artículo inicial, con mayúscula sólo al inicio (p. ej. «Press de banca con mancuernas»).
- Instrucciones: en segunda persona singular (tú), imperativo, claras y fieles al original; no
  agregues ni quites pasos ni advertencias médicas.
- Conserva el mismo número de pasos y el mismo id.`;

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Falta ANTHROPIC_API_KEY. Configúrala para traducir el catálogo.');
    process.exit(1);
  }
  const limitArg = process.argv.indexOf('--limit');
  const maxItems = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;

  const cache = `${CACHE_DIR}/fedb-${FEDB_COMMIT}.json`;
  if (!existsSync(cache)) throw new Error('Run build:catalog first (downloads the source data).');
  const fedb = (JSON.parse(await readFile(cache, 'utf8')) as unknown[]).map((x) => FedbExerciseSchema.parse(x));
  const translations: Translations = existsSync(TRANSLATIONS_FILE) ? JSON.parse(await readFile(TRANSLATIONS_FILE, 'utf8')) : {};

  const pending = fedb.filter((ex) => !translations[ex.id]).slice(0, maxItems);
  console.log(`${pending.length} exercises to translate with ${MODEL}`);
  const client = new Anthropic();
  let inputTokens = 0;
  let outputTokens = 0;

  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    const result = await translateBatch(client, batch);
    inputTokens += result.usage.input;
    outputTokens += result.usage.output;
    for (const item of result.items) {
      const source = batch.find((b) => b.id === item.id);
      if (!source || translations[item.id]?.reviewed) continue;
      translations[item.id] = {
        nameEs: item.nameEs.trim(),
        instructionsEs: cleanSteps(item.instructionsEs),
        reviewed: false,
        source: 'ai',
      };
    }
    // Save after every batch so an interruption loses nothing.
    await writeFile(TRANSLATIONS_FILE, JSON.stringify(sortKeys(translations), null, 2) + '\n');
    console.log(`  ${Math.min(i + BATCH, pending.length)}/${pending.length}`);
  }
  console.log(`tokens: ${inputTokens} in, ${outputTokens} out`);
}

async function translateBatch(client: Anthropic, batch: FedbExercise[]) {
  const payload = batch.map((ex) => ({ id: ex.id, name: ex.name, instructions: cleanSteps(ex.instructions) }));
  for (let attempt = 1; ; attempt++) {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: 'low', format: zodOutputFormat(OutputSchema) },
      messages: [{ role: 'user', content: `Traduce estas fichas:\n${JSON.stringify(payload)}` }],
    });
    const usage = { input: response.usage.input_tokens, output: response.usage.output_tokens };
    const parsed = response.parsed_output;
    const valid =
      response.stop_reason === 'end_turn' &&
      parsed &&
      parsed.items.length === batch.length &&
      parsed.items.every((it) => {
        const src = payload.find((p) => p.id === it.id);
        return src && it.nameEs.trim() && it.instructionsEs.length === src.instructions.length;
      });
    if (valid) return { items: parsed.items, usage };
    if (attempt >= 2) {
      console.warn(`  batch starting at ${batch[0]?.id} skipped (stop_reason=${response.stop_reason})`);
      return { items: [], usage };
    }
  }
}

function sortKeys<T>(obj: Record<string, T>) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
