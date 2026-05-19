import { CB, mainMenuKeyboard } from '../keyboards/index.js';
import { messages } from '../config/messages.js';
import { safeAnswerCbQuery } from '../utils/callback.js';

export function registerActions(bot) {
  bot.action(CB.ASK_QUESTION, async (ctx) => {
    await safeAnswerCbQuery(ctx);
    if (ctx.scene?.current === 'consultation') {
      await ctx.reply(
        'Чтобы задать вопрос, сначала отмените оформление заявки — команда /cancel.',
        mainMenuKeyboard(),
      );
      return;
    }
    await ctx.scene.enter('question');
  });

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
    if (ctx.scene?.current) {
      await ctx.scene.leave();
    }
    await ctx.reply(messages.welcome, mainMenuKeyboard());
  });
}
