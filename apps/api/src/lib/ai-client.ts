import Anthropic from '@anthropic-ai/sdk';
import type { Env } from '../env';

/** Price per million tokens, USD (Claude API first-party rates, 2026-11). Editable in settings. */
export const DEFAULT_PRICING: Record<string, { input: number; output: number; cacheRead: number }> = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.1 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
};

export function costUsd(model: string, usage: { input: number; output: number; cacheRead: number }, pricing = DEFAULT_PRICING) {
  const p = pricing[model] ?? DEFAULT_PRICING['claude-haiku-5-5']!;
  return (usage.input * p.input + usage.output * p.output + usage.cacheRead * p.cacheRead) / 1_000_000;
}

export function createAiClient(apiKey: string, config: Env) {
  return new Anthropic({ apiKey, baseURL: config.AI_BASE_URL, maxRetries: 0, timeout: 120_000 });
}

export interface AiGateway {
  /** Verifies a key without generating tokens (Models API). Throws on an invalid key. */
  testKey(apiKey: string, model: string): Promise<void>;
}

export function createAiGateway(config: Env): AiGateway {
  return {
    async testKey(apiKey, model) {
      await createAiClient(apiKey, config).models.retrieve(model);
    },
  };
}
