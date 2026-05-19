import { saveLead } from './leadsRepository.js';
import { notifyManagers } from './notify.js';
import { buildLeadRow } from '../utils/draft.js';

/** @param {import('telegraf').Context} ctx */
export async function submitLead(ctx, draft) {
  draft.createdAt = new Date().toISOString();
  const lead = buildLeadRow(draft);

  const result = await saveLead(lead);
  if (!result.ok) {
    return { ok: false };
  }

  await notifyManagers(ctx.telegram, lead);
  return { ok: true, lead };
}
