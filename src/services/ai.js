import OpenAI from 'openai';
import { config } from '../config/env.js';
import { messages } from '../config/messages.js';

const SYSTEM_PROMPT = `Ты вежливый ассистент юридической компании, которая проводит первичные консультации.
Правила:
- Не давай юридических советов, не оценивай перспективы дела.
- Отвечай кратко (2–4 предложения), по-русски.
- Мягко предложи записаться на консультацию через кнопку бота.
- Не проси паспортные данные и не запрашивай оплату.`;

let client = null;

function getClient() {
  if (!config.openaiApiKey) return null;
  if (!client) {
    client = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return client;
}

export async function replyToFreeText(userMessage) {
  const openai = getClient();
  if (!openai) {
    return messages.freeTextFallback;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: config.openaiModel,
      temperature: 0.4,
      max_tokens: 300,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    });

    const reply = completion.choices[0]?.message?.content?.trim();
    return reply || messages.freeTextFallback;
  } catch (err) {
    console.error('[AI] Ошибка:', err.message);
    return messages.freeTextFallback;
  }
}
