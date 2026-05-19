import { replyToFreeText, isAiEnabled } from '../services/ai.js';
import { mainMenuKeyboard } from '../keyboards/index.js';
import { withTypingIndicator } from '../utils/typing.js';

/**
 * Свободный текст вне сценария заявки (главное меню, до «Записаться»).
 */
export async function handleFreeText(ctx) {
  if (ctx.scene?.current) return;

  const text = ctx.message?.text?.trim();
  if (!text || text.startsWith('/')) return;

  const reply = isAiEnabled()
    ? await withTypingIndicator(ctx, () => replyToFreeText(text))
    : await replyToFreeText(text);

  await ctx.reply(reply, mainMenuKeyboard());
}
