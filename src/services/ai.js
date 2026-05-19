import { config } from '../config/env.js';
import { messages } from '../config/messages.js';
import { buildSystemPrompt } from '../config/aiSystemPrompt.js';
import { getCategories } from './catalog.js';
import { createChatCompletion } from './gigachatClient.js';

export function isAiEnabled() {
  return Boolean(config.gigachatAuthKey);
}

/**
 * Ответ на свободный текст в главном меню (до «Записаться на консультацию»).
 * @param {string} userMessage
 */
export async function replyToFreeText(userMessage) {
  if (!isAiEnabled()) {
    return messages.freeTextFallback;
  }

  try {
    const categories = await getCategories();
    const systemPrompt = buildSystemPrompt(categories.map((c) => c.label));

    return await createChatCompletion({ systemPrompt, userMessage });
  } catch (err) {
    const msg = err?.message ?? String(err);
    console.error('[AI] Ошибка GigaChat:', msg);
    if (/429|quota|лимит|limit/i.test(msg)) {
      return messages.aiQuotaError;
    }
    return messages.freeTextFallback;
  }
}
