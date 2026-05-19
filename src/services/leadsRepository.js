import { getSupabase } from '../lib/supabase.js';

/**
 * @param {ReturnType<import('../utils/draft.js').buildLeadRow>} lead
 */
export async function saveLead(lead) {
  const { error } = await getSupabase().from('leads').insert({
    external_id: lead.id,
    created_at: lead.createdAt,
    telegram_user_id: lead.telegramUserId,
    username: lead.username ?? '',
    display_name: lead.displayName,
    phone: lead.phone,
    category_id: lead.categoryId,
    category_label: lead.categoryLabel,
    description: lead.description,
    urgency: lead.urgency,
    has_documents: lead.hasDocuments,
    contact_method: lead.contactMethod,
    status: lead.status,
  });

  if (error) {
    console.error('[Supabase] Ошибка сохранения заявки:', error.message);
    return { ok: false, error };
  }

  console.log('[Supabase] Заявка сохранена:', lead.id);
  return { ok: true };
}
