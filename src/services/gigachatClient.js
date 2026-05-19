import crypto from 'node:crypto';
import { Agent, fetch as undiciFetch } from 'undici';
import { config } from '../config/env.js';

const OAUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
const CHAT_URL = 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions';

/** @type {{ token: string | null, expiresAt: number }} */
const tokenCache = { token: null, expiresAt: 0 };

let dispatcher = null;

function getDispatcher() {
  if (!config.gigachatInsecureSsl) return undefined;
  if (!dispatcher) {
    dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
  }
  return dispatcher;
}

async function gigachatFetch(url, options = {}) {
  return undiciFetch(url, { ...options, dispatcher: getDispatcher() });
}

function normalizeAuthKey(key) {
  const trimmed = key.trim();
  return trimmed.toLowerCase().startsWith('basic ') ? trimmed.slice(6).trim() : trimmed;
}

async function fetchAccessToken() {
  const now = Date.now();
  if (tokenCache.token && now < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const response = await gigachatFetch(OAUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      RqUID: crypto.randomUUID(),
      Authorization: `Basic ${normalizeAuthKey(config.gigachatAuthKey)}`,
    },
    body: `scope=${encodeURIComponent(config.gigachatScope)}`,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `OAuth ${response.status}`);
  }

  tokenCache.token = data.access_token;
  tokenCache.expiresAt =
    typeof data.expires_at === 'number' ? data.expires_at : now + 30 * 60 * 1000;

  return tokenCache.token;
}

/**
 * @param {{ systemPrompt: string, userMessage: string }} params
 */
export async function createChatCompletion({ systemPrompt, userMessage }) {
  const accessToken = await fetchAccessToken();

  const response = await gigachatFetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      model: config.gigachatModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: config.gigachatTemperature,
      max_tokens: config.gigachatMaxTokens,
      stream: false,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || JSON.stringify(data) || `Chat ${response.status}`);
  }

  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('Пустой ответ GigaChat');
  }
  return content;
}
