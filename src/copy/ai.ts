// Copy shared by every AI tool. Plain, friendly, short. No em dashes.

/** Why AI tools need the guest sign-in. True for AI Notes, AI Slides, Notes → Game and
 * receipt scanning: the server refuses AI requests without it (api/_lib/ai.ts). */
export const AI_SIGNIN_NOTE =
  'AI tools need a quick guest sign-in, for security. It happens by itself in the background: no account, no email. It stops bots from using up the free AI for everyone.';
