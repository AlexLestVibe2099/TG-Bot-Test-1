import { replyToFreeText } from '../services/ai.js';
import { mainMenuKeyboard } from '../keyboards/index.js';

export async function handleFreeText(ctx) {
  if (ctx.scene?.current) return;
  const text = ctx.message?.text?.trim();
  if (!text || text.startsWith('/')) return;

  const reply = await replyToFreeText(text);
  await ctx.reply(reply, mainMenuKeyboard());
}
