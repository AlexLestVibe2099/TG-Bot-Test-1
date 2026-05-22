import { replyWithAi, isAiEnabled } from '../services/ai.js';
import { mainMenuKeyboard } from '../keyboards/index.js';
import { withTypingIndicator } from '../utils/typing.js';
import { handleReset, isResetIntent } from './commands.js';

/**
 * Свободный текст вне сценария заявки (главное меню).
 */
export async function handleFreeText(ctx) {
  if (ctx.scene?.current) return;

  const text = ctx.message?.text?.trim();
  if (!text) return;
  if (isResetIntent(text)) {
    return handleReset(ctx);
  }
  if (text.startsWith('/')) return;

  const reply = isAiEnabled()
    ? await withTypingIndicator(ctx, () => replyWithAi(ctx, text))
    : await replyWithAi(ctx, text);

  await ctx.reply(reply, mainMenuKeyboard());
}
