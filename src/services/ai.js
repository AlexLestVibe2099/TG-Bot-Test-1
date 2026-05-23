import { config } from '../config/env.js';
import { messages } from '../config/messages.js';
import { buildSystemPrompt } from '../config/aiSystemPrompt.js';
import { getCategories } from './catalog.js';
import { createChatCompletion } from './gigachatClient.js';
import {
  appendChatTurn,
  clearChatHistory,
  getChatHistoryForApi,
} from '../utils/chatHistory.js';
import { isRagEnabled, retrieveForQuestion } from './rag.js';

export function isAiEnabled() {
  return Boolean(config.gigachatAuthKey);
}

/**
 * Ответ ассистента с учётом истории диалога (до 10 сообщений).
 * @param {import('telegraf').Context} ctx
 * @param {string} userMessage
 * @param {{ resetHistory?: boolean }} [options]
 */
export async function replyWithAi(ctx, userMessage, options = {}) {
  if (!isAiEnabled()) {
    return messages.freeTextFallback;
  }

  if (options.resetHistory) {
    clearChatHistory(ctx.session);
  }

  try {
    const categories = await getCategories();
    let ragContext = '';
    if (isRagEnabled()) {
      try {
        const { contextText } = await retrieveForQuestion(ctx, userMessage);
        ragContext = contextText;
      } catch (ragErr) {
        console.error('[RAG] Ошибка поиска:', ragErr?.message ?? ragErr);
        ragContext = '(Поиск по базе знаний временно недоступен.)';
      }
    }
    const systemPrompt = buildSystemPrompt(
      categories.map((c) => c.label),
      ragContext,
    );
    const history = options.resetHistory ? [] : getChatHistoryForApi(ctx.session);

    const reply = await createChatCompletion({
      systemPrompt,
      history,
      userMessage,
    });

    appendChatTurn(ctx.session, 'user', userMessage);
    appendChatTurn(ctx.session, 'assistant', reply);

    return reply;
  } catch (err) {
    const msg = err?.message ?? String(err);
    console.error('[AI] Ошибка GigaChat:', msg);
    if (/429|quota|лимит|limit/i.test(msg)) {
      return messages.aiQuotaError;
    }
    return messages.freeTextFallback;
  }
}

/** @deprecated Используйте replyWithAi */
export async function replyToFreeText(userMessage) {
  if (!isAiEnabled()) {
    return messages.freeTextFallback;
  }

  try {
    const categories = await getCategories();
    const systemPrompt = buildSystemPrompt(categories.map((c) => c.label), '');
    return await createChatCompletion({ systemPrompt, history: [], userMessage });
  } catch (err) {
    const msg = err?.message ?? String(err);
    console.error('[AI] Ошибка GigaChat:', msg);
    if (/429|quota|лимит|limit/i.test(msg)) {
      return messages.aiQuotaError;
    }
    return messages.freeTextFallback;
  }
}
