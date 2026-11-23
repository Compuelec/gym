import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { eq, sql } from 'drizzle-orm';
import {
  CoachProgramSchema,
  CoachReviewSchema,
  SAFETY_NOTE_ES,
  mentionsHealth,
  type CoachProgram,
} from '@gym/shared';
import type { z } from 'zod';
import type { Database } from '../db/client';
import { appSettings, coachRequests } from '../db/schema';
import type { Env } from '../env';
import { costUsd, createAiClient, DEFAULT_PRICING } from '../lib/ai-client';
import { availability, getSettings, monthSpendUsd, resolveKey } from '../lib/ai-settings';
import { loadCatalog } from '../lib/catalog';
import { buildContext, profileText } from '../lib/coach-context';
import { COACH_SYSTEM, REVIEW_SYSTEM } from '../lib/coach-prompt';
import { validateProgram, validateReview } from '../lib/coach-validate';
import { logger } from '../logger';

export type ClientFactory = (apiKey: string) => Anthropic;

const MESSAGES = {
  unavailable: 'El coach no está disponible en este momento.',
  refusal: 'El coach no pudo responder a esta solicitud. Reformúlala e intenta de nuevo.',
  invalid:
    'El coach propuso un programa que no se ajusta a tu equipo o tiempo. Intenta de nuevo con más detalles.',
  transient: 'El coach no respondió, intenta más tarde.',
  noProfile: 'Completa tu perfil antes de usar el coach.',
};

const TRANSIENT_STATUS = new Set([408, 409, 429, 500, 502, 503, 504, 529]);
const BACKOFF_MS = [1_000, 3_000];

function isTransient(err: unknown) {
  if (err instanceof Anthropic.APIConnectionError) return true; // includes timeouts
  return err instanceof Anthropic.APIError && TRANSIENT_STATUS.has(err.status ?? 0);
}

interface Usage {
  input: number;
  output: number;
  cacheRead: number;
}

async function callStructured<T extends z.ZodType>(
  client: Anthropic,
  opts: {
    model: string;
    effort: 'low' | 'medium';
    system: string;
    cacheable: string;
    user: string;
    schema: T;
  },
  sleep: (ms: number) => Promise<void>,
) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await client.messages.parse({
        model: opts.model,
        max_tokens: 8000,
        // Stable prefix (instructions + catalog) is cached; the user's request goes last.
        system: [
          { type: 'text', text: opts.system },
          { type: 'text', text: opts.cacheable, cache_control: { type: 'ephemeral' } },
        ],
        output_config: { effort: opts.effort, format: zodOutputFormat(opts.schema) },
        messages: [{ role: 'user', content: opts.user }],
      });
      const usage: Usage = {
        input: response.usage.input_tokens ?? 0,
        output: response.usage.output_tokens ?? 0,
        cacheRead: response.usage.cache_read_input_tokens ?? 0,
      };
      return {
        stopReason: response.stop_reason,
        parsed: response.parsed_output as z.infer<T> | null,
        usage,
      };
    } catch (err) {
      if (isTransient(err) && attempt < BACKOFF_MS.length) {
        await sleep(BACKOFF_MS[attempt]!);
        continue;
      }
      throw err;
    }
  }
}

/** Takes one queued request (SKIP LOCKED, so several workers never take the same one). */
async function claim(db: Database) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(coachRequests)
      .where(eq(coachRequests.status, 'queued'))
      .orderBy(coachRequests.createdAt)
      .limit(1)
      .for('update', { skipLocked: true });
    if (!row) return null;
    await tx
      .update(coachRequests)
      .set({ status: 'running', updatedAt: sql`now()` })
      .where(eq(coachRequests.id, row.id));
    return row;
  });
}

export async function processNextCoachRequest(
  db: Database,
  config: Env,
  deps: { clientFactory?: ClientFactory; sleep?: (ms: number) => Promise<void> } = {},
): Promise<boolean> {
  const req = await claim(db);
  if (!req) return false;
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const fail = (errorMessage: string, extra: Record<string, unknown> = {}) =>
    db
      .update(coachRequests)
      .set({ status: 'failed', errorMessage, updatedAt: sql`now()`, ...extra })
      .where(eq(coachRequests.id, req.id));

  const settings = await getSettings(db);
  // The admin may have switched it off (or the budget ran out) after the request was queued.
  if (!availability(settings, config).available) {
    await fail(MESSAGES.unavailable);
    return true;
  }
  if ((await monthSpendUsd(db)) >= settings.aiMonthlyBudgetUsd) {
    await db.update(appSettings).set({ aiPausedReason: 'BUDGET_REACHED' });
    await fail(MESSAGES.unavailable);
    return true;
  }
  const apiKey = resolveKey(settings, config)!;
  const client = (deps.clientFactory ?? ((k: string) => createAiClient(k, config)))(apiKey);
  const model = settings.aiModel;
  const pricing = (settings.aiPricing as typeof DEFAULT_PRICING | null) ?? DEFAULT_PRICING;
  const message = String((req.messages as Array<{ content: string }>)[0]?.content ?? '');
  const locationIds = (req.messages as Array<{ locationIds?: string[] }>)[0]?.locationIds;
  const total: Usage = { input: 0, output: 0, cacheRead: 0 };
  const add = (u: Usage) => {
    total.input += u.input;
    total.output += u.output;
    total.cacheRead += u.cacheRead;
  };

  try {
    let ctx;
    try {
      ctx = await buildContext(db, req.ownerId, await loadCatalog(config), locationIds);
    } catch (err) {
      if ((err as Error).message === 'NO_PROFILE') {
        await fail(MESSAGES.noProfile);
        return true;
      }
      throw err;
    }
    const cacheable = `Catálogo disponible (id|nombre|músculos|equipo|nivel|mecánica|medida):\n${ctx.catalogLines}`;

    if (req.kind === 'program') {
      let user = `${profileText(ctx)}\n\nHistorial reciente:\n${ctx.historyText}\n\nPedido del usuario:\n${message}`;
      let result: CoachProgram | null = null;
      let errors: string[] = [];
      for (let round = 0; round < 2; round++) {
        const r = await callStructured(
          client,
          {
            model,
            effort: 'medium',
            system: COACH_SYSTEM,
            cacheable,
            user,
            schema: CoachProgramSchema,
          },
          sleep,
        );
        add(r.usage);
        if (r.stopReason === 'refusal') {
          await fail(MESSAGES.refusal, usageFields(model, total, pricing));
          return true;
        }
        if (r.stopReason !== 'end_turn' || !r.parsed) continue;
        const v = validateProgram(r.parsed, {
          catalog: ctx.catalogMap,
          locations: new Map(ctx.locations.map((l) => [l.id, l.equipment])),
          daysPerWeek: ctx.profile.daysPerWeek,
          sessionMinutes: ctx.profile.sessionMinutes,
        });
        result = v.program;
        errors = v.errors;
        if (!v.retry) break;
        // One more try, telling the model exactly what was wrong.
        user += `\n\nTu propuesta anterior tenía estos problemas; corrígelos:\n- ${v.errors.join('\n- ')}`;
      }
      if (!result || result.days.length === 0 || result.days.some((d) => d.items.length === 0)) {
        await fail(MESSAGES.invalid, {
          validationErrors: errors,
          ...usageFields(model, total, pricing),
        });
        return true;
      }
      // Deterministic safety net: health topics always carry the referral note.
      if (mentionsHealth(message) && !result.safetyNoteEs)
        result = { ...result, safetyNoteEs: SAFETY_NOTE_ES };
      await done(db, req.id, result, errors, model, total, pricing);
    } else {
      const user = `${profileText(ctx)}\n\nÚltimas 4 semanas:\n${ctx.historyText}\n\nComentario del usuario para la revisión semanal:\n${message}`;
      const r = await callStructured(
        client,
        { model, effort: 'low', system: REVIEW_SYSTEM, cacheable, user, schema: CoachReviewSchema },
        sleep,
      );
      add(r.usage);
      if (r.stopReason === 'refusal') {
        await fail(MESSAGES.refusal, usageFields(model, total, pricing));
        return true;
      }
      if (r.stopReason !== 'end_turn' || !r.parsed) {
        await fail(MESSAGES.invalid, usageFields(model, total, pricing));
        return true;
      }
      const review = validateReview(r.parsed, ctx.routineIds, ctx.catalogMap);
      if (mentionsHealth(message))
        review.concernsEs = [SAFETY_NOTE_ES, ...review.concernsEs].slice(0, 5);
      await done(db, req.id, review, [], model, total, pricing);
    }
  } catch (err) {
    if (
      err instanceof Anthropic.AuthenticationError ||
      (err instanceof Anthropic.APIError && err.status === 401)
    ) {
      // The key was revoked: pause and let the admin know (shown in the admin screen).
      await db.update(appSettings).set({ aiPausedReason: 'KEY_REJECTED' });
      await fail(MESSAGES.unavailable, usageFields(model, total, pricing));
    } else if (isTransient(err)) {
      await fail(MESSAGES.transient, { ...usageFields(model, total, pricing), status: 'failed' });
    } else {
      logger.error({ err: (err as Error).message, requestId: req.id }, 'coach request failed');
      await fail(MESSAGES.transient, usageFields(model, total, pricing));
    }
  }
  // Budget check after spending.
  const after = await getSettings(db);
  if ((await monthSpendUsd(db)) >= after.aiMonthlyBudgetUsd && !after.aiPausedReason) {
    await db.update(appSettings).set({ aiPausedReason: 'BUDGET_REACHED' });
  }
  return true;
}

function usageFields(model: string, u: Usage, pricing: typeof DEFAULT_PRICING) {
  return {
    model,
    inputTokens: u.input,
    outputTokens: u.output,
    cacheReadTokens: u.cacheRead,
    costUsd: costUsd(model, u, pricing),
  };
}

async function done(
  db: Database,
  id: string,
  result: unknown,
  errors: string[],
  model: string,
  u: Usage,
  pricing: typeof DEFAULT_PRICING,
) {
  await db
    .update(coachRequests)
    .set({
      status: 'done',
      resultJson: result,
      validationErrors: errors.length ? errors : null,
      updatedAt: sql`now()`,
      ...usageFields(model, u, pricing),
    })
    .where(eq(coachRequests.id, id));
}
