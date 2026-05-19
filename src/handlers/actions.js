import { CB, mainMenuKeyboard } from '../keyboards/index.js';
import { messages } from '../config/messages.js';
import { safeAnswerCbQuery } from '../utils/callback.js';

export function registerActions(bot) {
  bot.action(CB.START_CONSULT, async (ctx) => {
    await safeAnswerCbQuery(ctx);
    await ctx.scene.enter('consultation');
  });

  bot.action(CB.NEW_REQUEST, async (ctx) => {
    await safeAnswerCbQuery(ctx);
    await ctx.scene.enter('consultation');
  });

  bot.action(CB.TO_MENU, async (ctx) => {
    await safeAnswerCbQuery(ctx);
    await ctx.reply(messages.welcome, mainMenuKeyboard());
  });
}
