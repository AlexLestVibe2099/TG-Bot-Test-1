/**
 * Имитация записи в Google Sheets.
 * В продакшене здесь будет google-spreadsheet / Google Sheets API.
 */

const leadsStore = [];

export function getStoredLeads() {
  return [...leadsStore];
}

/** @param {ReturnType<import('../utils/draft.js').buildLeadRow>} lead */
export async function appendLeadToSheets(lead) {
  leadsStore.push(lead);

  const row = [
    lead.id,
    lead.createdAt,
    lead.telegramUserId,
    lead.username,
    lead.displayName,
    lead.phone,
    lead.categoryLabel,
    lead.description,
    lead.urgency,
    lead.hasDocuments,
    lead.contactMethod,
    lead.status,
  ];

  console.log('[Sheets] Новая заявка:', row.join(' | '));
  return { ok: true };
}
