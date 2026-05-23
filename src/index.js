import { createBot } from './bot.js';
import { config } from './config/env.js';
import { verifyBotToken } from './services/telegramCheck.js';
import { verifySupabaseConnection, warmupCatalog } from './services/catalog.js';
import { isAiEnabled } from './services/ai.js';
import { isRagEnabled, warmupRag } from './services/rag.js';

const bot = createBot();

async function main() {
  console.log('Бот запускается…');
  console.log(`ℹ BOT_TOKEN загружен из .env (${config.botToken.length} символов)`);

  try {
    await verifySupabaseConnection();
    const { categories, managers } = await warmupCatalog();
    console.log(`✓ Supabase: ${categories} категорий, ${managers} менеджеров`);
  } catch (err) {
    console.error('\n❌ Ошибка Supabase:', err.message);
    console.error('   Проверьте SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env');
    console.error('   Выполните SQL из supabase/schema.sql в Supabase → SQL Editor\n');
    process.exit(1);
  }

  if (!config.managerChatIds.length) {
    console.warn(
      '⚠ MANAGER_CHAT_IDS не задан — уведомления только на telegram_chat_id из таблицы managers',
    );
  }
  if (isAiEnabled()) {
    console.log(
      `✓ GigaChat: ${config.gigachatModel} (temperature=${config.gigachatTemperature}, max_tokens=${config.gigachatMaxTokens})`,
    );
  } else {
    console.warn('⚠ GIGACHAT_AUTH_KEY не задан — свободный текст без LLM (шаблон)');
  }

  if (isRagEnabled() && isAiEnabled()) {
    try {
      console.log(
        `ℹ RAG: поиск top-${config.ragMatchCount}, порог ${config.ragMinSimilarity} (прогрев модели…)`,
      );
      await warmupRag();
      console.log('✓ RAG: база знаний подключена');
    } catch (err) {
      console.warn('⚠ RAG: прогрев не удался — первый вопрос может быть медленнее:', err.message);
    }
  } else if (!isRagEnabled()) {
    console.log('ℹ RAG отключён (RAG_ENABLED=false)');
  }

  try {
    const me = await verifyBotToken(config.botToken);
    console.log(`✓ Токен действителен: @${me.username} (${me.first_name})`);
  } catch (err) {
    console.error('\n❌ Telegram отклонил BOT_TOKEN:', err.message);
    console.error(
      '   Проверьте токен в .env (BotFather → /mybots → API Token).\n' +
        '   Если в системе задан старый BOT_TOKEN — удалите его в переменных среды Windows.\n',
    );
    process.exit(1);
  }

  console.log('✅ Бот запущен (long polling)');
  await bot.launch();
}

main().catch((err) => {
  console.error('❌ Ошибка запуска:', err.message);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
