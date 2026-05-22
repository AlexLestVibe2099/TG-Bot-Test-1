import { Scenes } from 'telegraf';
import { messages } from '../config/messages.js';
import { CB, mainMenuKeyboard } from '../keyboards/index.js';
import { replyWithAi, isAiEnabled } from '../services/ai.js';
import { withTypingIndicator } from '../utils/typing.js';
import { safeAnswerCbQuery } from '../utils/callback.js';
import { handleReset, isResetIntent, registerSceneCommands } from '../handlers/commands.js';

export const questionScene = new Scenes.BaseScene('question');

registerSceneCommands(questionScene);

questionScene.enter(async (ctx) => {
  await ctx.reply(messages.askQuestionIntro, mainMenuKeyboard());
});

questionScene.on('text', async (ctx) => {
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
