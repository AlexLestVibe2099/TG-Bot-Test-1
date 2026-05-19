import { createBot } from './bot.js';
import { config } from './config/env.js';

const bot = createBot();

console.log('Бот запускается…');
if (!config.managerChatIds.length) {
  console.warn('⚠ MANAGER_CHAT_IDS не задан — менеджеры не получат уведомления');
}
if (!config.openaiApiKey) {
  console.log('ℹ OPENAI_API_KEY не задан — свободный текст обрабатывается шаблоном');
}

bot.launch().then(() => {
  console.log('✅ Бот запущен (long polling)');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
