import { CB, mainMenuKeyboard } from '../keyboards/index.js';
import { messages } from '../config/messages.js';

export function registerActions(bot) {
  bot.action(CB.START_CONSULT, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.enter('consultation');
  });

  bot.action(CB.NEW_REQUEST, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.enter('consultation');
  });

  bot.action(CB.TO_MENU, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(messages.welcome, mainMenuKeyboard());
  });
}
