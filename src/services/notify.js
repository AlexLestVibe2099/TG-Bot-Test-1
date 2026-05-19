import { config } from '../config/env.js';
import { getManagerLine } from '../config/managers.js';
import { escapeMarkdown } from '../utils/markdown.js';

/** @param {import('telegraf').Telegraf['telegram']} telegram */
export async function notifyManagers(telegram, lead) {
  const chatIds = config.managerChatIds;
  if (!chatIds.length) {
    console.warn('[Notify] MANAGER_CHAT_IDS не задан — уведомление менеджерам пропущено');
    return;
  }

  const userLink = lead.telegramUserId
    ? `[открыть чат](tg://user?id=${lead.telegramUserId})`
    : '—';

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
    getManagerLine(),
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
