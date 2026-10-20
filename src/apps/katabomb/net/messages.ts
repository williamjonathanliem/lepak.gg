import { z } from 'zod';
import { LIMITS } from '../logic/types';

// What players send to the host. Everything from the network is checked against these
// before the host acts on it, so a tampered client can't send nonsense.

export const IntentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('join'), nickname: z.string().min(1).max(32) }),
  z.object({ type: z.literal('ready'), ready: z.boolean() }),
  z.object({ type: z.literal('submit'), word: z.string().max(LIMITS.maxWordLength + 10) }),
  z.object({ type: z.literal('leave') }),
  z.object({
    type: z.literal('style'),
    color: z.number().int().min(0).max(7).nullable().optional(),
    emoji: z.string().max(8).nullable().optional(),
  }),
]);

export type Intent = z.infer<typeof IntentSchema>;

export const TypingSchema = z.string().max(LIMITS.maxWordLength + 10);

export function parseIntent(data: unknown): Intent | null {
  const result = IntentSchema.safeParse(data);
  return result.success ? result.data : null;
}
