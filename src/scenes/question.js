import { Scenes } from 'telegraf';
import { messages } from '../config/messages.js';
import { CB, mainMenuKeyboard } from '../keyboards/index.js';
import { replyToFreeText, isAiEnabled } from '../services/ai.js';
import { withTypingIndicator } from '../utils/typing.js';
import { safeAnswerCbQuery } from '../utils/callback.js';

export const questionScene = new Scenes.BaseScene('question');

questionScene.enter(async (ctx) => {
  await ctx.reply(messages.askQuestionIntro, mainMenuKeyboard());
});

questionScene.on('text', async (ctx) => {
  const text = ctx.message?.text?.trim();
  if (!text || text.startsWith('/')) return;

  const reply = isAiEnabled()
    ? await withTypingIndicator(ctx, () => replyToFreeText(text))
    : await replyToFreeText(text);

  await ctx.reply(reply, mainMenuKeyboard());
});

questionScene.action(CB.ASK_QUESTION, async (ctx) => {
  await safeAnswerCbQuery(ctx);
  await ctx.reply(messages.askQuestionIntro, mainMenuKeyboard());
});

questionScene.action(CB.START_CONSULT, async (ctx) => {
  await safeAnswerCbQuery(ctx);
  await ctx.scene.enter('consultation');
});

questionScene.action(CB.TO_MENU, async (ctx) => {
  await safeAnswerCbQuery(ctx);
  await ctx.reply(messages.welcome, mainMenuKeyboard());
  return ctx.scene.leave();
});
