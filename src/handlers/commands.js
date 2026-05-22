import { messages } from '../config/messages.js';
import { mainMenuKeyboard } from '../keyboards/index.js';
import { clearChatHistory } from '../utils/chatHistory.js';

/** @param {string} [text] */
export function isResetIntent(text) {
  const t = text?.trim() ?? '';
  return /^(?:\/reset|reset|сброс|начать заново)$/i.test(t);
}

/** Команды внутри сцен (глобальные bot.command в сцене не срабатывают). */
export function registerSceneCommands(scene) {
  scene.command('start', handleStart);
  scene.command('reset', handleReset);
  scene.command('help', handleHelp);
  scene.command('cancel', handleCancel);
}

export async function handleStart(ctx) {
  if (ctx.scene?.current) {
    await ctx.scene.leave();
  }
  ctx.session.draft = null;
  await ctx.reply(messages.welcome, mainMenuKeyboard());
}

export async function handleReset(ctx) {
  if (ctx.scene?.current) {
    await ctx.scene.leave();
  }
  ctx.session.draft = null;
  clearChatHistory(ctx.session);
  await ctx.reply(messages.resetDone, mainMenuKeyboard());
}

export async function handleHelp(ctx) {
  await ctx.reply(messages.help, { parse_mode: 'Markdown', ...mainMenuKeyboard() });
}

export async function handleCancel(ctx) {
  if (ctx.scene?.current) {
    await ctx.scene.leave();
  }
  ctx.session.draft = null;
  await ctx.reply(messages.cancelDone, mainMenuKeyboard());
}
