import { Telegraf, session, Scenes } from 'telegraf';
import { config } from './config/env.js';
import { consultationScene } from './scenes/consultation.js';
import { questionScene } from './scenes/question.js';
import { handleStart, handleHelp, handleCancel } from './handlers/commands.js';
import { registerActions } from './handlers/actions.js';
import { handleFreeText } from './handlers/freeText.js';

export function createBot() {
  const bot = new Telegraf(config.botToken);

  const stage = new Scenes.Stage([consultationScene, questionScene]);

  bot.use(session());
  bot.use(stage.middleware());

  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('cancel', handleCancel);

  registerActions(bot);

  bot.on('text', async (ctx, next) => {
    if (ctx.scene?.current) return next();
    return handleFreeText(ctx);
  });

  bot.catch((err, ctx) => {
    console.error(`[Bot] Ошибка для ${ctx.updateType}:`, err);
  });

  return bot;
}
