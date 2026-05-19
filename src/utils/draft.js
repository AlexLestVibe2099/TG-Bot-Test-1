export function createEmptyDraft(from) {
  return {
    telegramUserId: from.id,
    username: from.username ? `@${from.username}` : '',
    telegramFirstName: from.first_name ?? '',
    telegramLastName: from.last_name ?? '',
    displayName: '',
    phone: '',
    categoryId: '',
    categoryLabel: '',
    description: '',
    urgency: '',
    hasDocuments: '',
    contactMethod: '',
    createdAt: null,
  };
}

import { escapeMarkdown } from './markdown.js';

export function formatDraftSummary(draft) {
  return [
    `👤 *Имя:* ${escapeMarkdown(draft.displayName)}`,
    `📞 *Телефон:* ${escapeMarkdown(draft.phone)}`,
    `📂 *Категория:* ${escapeMarkdown(draft.categoryLabel)}`,
    `📝 *Описание:*\n${escapeMarkdown(draft.description)}`,
    `⏱ *Срочность:* ${escapeMarkdown(draft.urgency)}`,
    `📎 *Документы:* ${escapeMarkdown(draft.hasDocuments)}`,
    `📬 *Связь:* ${escapeMarkdown(draft.contactMethod)}`,
  ].join('\n\n');
}

export function buildLeadRow(draft) {
  const createdAt = draft.createdAt ?? new Date().toISOString();
  return {
    id: `lead_${Date.now()}_${draft.telegramUserId}`,
    createdAt,
    telegramUserId: draft.telegramUserId,
    username: draft.username,
    displayName: draft.displayName,
    phone: draft.phone,
    categoryId: draft.categoryId,
    categoryLabel: draft.categoryLabel,
    description: draft.description,
    urgency: draft.urgency,
    hasDocuments: draft.hasDocuments,
    contactMethod: draft.contactMethod,
    status: 'Новая',
  };
}
