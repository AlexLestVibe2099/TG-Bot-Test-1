import OpenAI from 'openai';
import { config } from '../config/env.js';
import { messages } from '../config/messages.js';
import { buildSystemPrompt } from '../config/aiSystemPrompt.js';
import { getCategories } from './catalog.js';

let client = null;

function getClient() {
  if (!config.openaiApiKey) return null;
  if (!client) {
    client = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return client;
}

export function isAiEnabled() {
  return Boolean(config.openaiApiKey);
}

/**
 * Ответ на свободный текст в главном меню (до «Записаться на консультацию»).
 * @param {string} userMessage
 */
export async function replyToFreeText(userMessage) {
  const openai = getClient();
  if (!openai) {
    return messages.freeTextFallback;
  }

  try {
    const categories = await getCategories();
    const systemPrompt = buildSystemPrompt(categories.map((c) => c.label));

    const completion = await openai.chat.completions.create({
      model: config.openaiModel,
      temperature: config.openaiTemperature,
      max_tokens: config.openaiMaxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });

    const reply = completion.choices[0]?.message?.content?.trim();
    return reply || messages.freeTextFallback;
  } catch (err) {
    console.error('[AI] Ошибка OpenAI:', err.message);
    return messages.freeTextFallback;
  }
}
