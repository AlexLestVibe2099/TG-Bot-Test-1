import { messages } from '../config/messages.js';
import { mainMenuKeyboard } from '../keyboards/index.js';

export async function handleStart(ctx) {
  if (ctx.scene?.current) {
    await ctx.scene.leave();
  }
  ctx.session.draft = null;
  await ctx.reply(messages.welcome, mainMenuKeyboard());
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
