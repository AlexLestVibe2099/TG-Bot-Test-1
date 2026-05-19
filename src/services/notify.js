import { getManagerLine, getNotificationChatIds } from './catalog.js';
import { escapeMarkdown } from '../utils/markdown.js';

/** @param {import('telegraf').Telegraf['telegram']} telegram */
export async function notifyManagers(telegram, lead) {
  const chatIds = await getNotificationChatIds();
  if (!chatIds.length) {
    console.warn(
      '[Notify] Нет получателей — задайте MANAGER_CHAT_IDS в .env или telegram_chat_id в таблице managers',
    );
    return;
  }

  const userLink = lead.telegramUserId
    ? `[открыть чат](tg://user?id=${lead.telegramUserId})`
    : '—';

  const managerLine = await getManagerLine();

  const text = [
    '🆕 *Новая заявка на консультацию*',
    '',
    `🆔 \`${lead.id}\``,
    `📅 ${lead.createdAt}`,
    '',
    `👤 *${escapeMarkdown(lead.displayName)}*`,
    `📞 ${escapeMarkdown(lead.phone)}`,
    lead.username ? `💬 ${escapeMarkdown(lead.username)}` : null,
    `🔗 ${userLink}`,
    '',
    `📂 *Категория:* ${escapeMarkdown(lead.categoryLabel)}`,
    `⏱ *Срочность:* ${escapeMarkdown(lead.urgency)}`,
    `📎 *Документы:* ${escapeMarkdown(lead.hasDocuments)}`,
    `📬 *Связь:* ${escapeMarkdown(lead.contactMethod)}`,
    '',
    `📝 *Описание:*\n${escapeMarkdown(lead.description)}`,
    '',
    '_Команда:_',
    managerLine,
  ]
    .filter(Boolean)
    .join('\n');

  await Promise.all(
    chatIds.map((chatId) =>
      telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' }).catch((err) => {
        console.error(`[Notify] Ошибка отправки в ${chatId}:`, err.message);
      }),
    ),
  );
}
