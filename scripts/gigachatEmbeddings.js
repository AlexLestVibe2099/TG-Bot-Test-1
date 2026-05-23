/**
 * Эмбеддинги GigaChat API (POST /api/v1/embeddings).
 * Использует те же переменные, что и бот: GIGACHAT_AUTH_KEY, GIGACHAT_SCOPE, GIGACHAT_INSECURE_SSL.
 */
import crypto from 'node:crypto';
import { Agent, fetch as undiciFetch } from 'undici';

const OAUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
const EMBEDDINGS_URL = 'https://gigachat.devices.sberbank.ru/api/v1/embeddings';

/** @type {{ token: string | null, expiresAt: number }} */
const tokenCache = { token: null, expiresAt: 0 };

let dispatcher = null;

function getDispatcher(insecureSsl) {
  if (!insecureSsl) return undefined;
  if (!dispatcher) {
    dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
  }
  return dispatcher;
}

function gigachatFetch(url, options, insecureSsl) {
  return undiciFetch(url, { ...options, dispatcher: getDispatcher(insecureSsl) });
}

function normalizeAuthKey(key) {
  const trimmed = key.trim();
  return trimmed.toLowerCase().startsWith('basic ') ? trimmed.slice(6).trim() : trimmed;
}

/**
 * @param {{ authKey: string, scope: string, insecureSsl?: boolean }} config
 */
async function fetchAccessToken(config) {
  const now = Date.now();
  if (tokenCache.token && now < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const response = await gigachatFetch(
    OAUTH_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        RqUID: crypto.randomUUID(),
        Authorization: `Basic ${normalizeAuthKey(config.authKey)}`,
      },
      body: `scope=${encodeURIComponent(config.scope)}`,
    },
    config.insecureSsl !== false,
  );

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
 * @param {{ authKey: string, scope: string, model: string, insecureSsl?: boolean }} config
 * @param {string[]} inputs
 * @returns {Promise<number[][]>}
 */
export async function embedTexts(config, inputs) {
  if (inputs.length === 0) return [];

  const accessToken = await fetchAccessToken(config);

  const response = await gigachatFetch(
    EMBEDDINGS_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        model: config.model,
        input: inputs,
      }),
    },
    config.insecureSsl !== false,
  );

  const data = await response.json();
  if (!response.ok) {
    if (response.status === 402) {
      throw new Error(
        'GigaChat: недостаточно средств для эмбеддингов (Payment Required). Пополните баланс в личном кабинете developers.sber.ru',
      );
    }
    throw new Error(data?.message || JSON.stringify(data) || `Embeddings ${response.status}`);
  }

  const items = data?.data;
  if (!Array.isArray(items) || items.length !== inputs.length) {
    throw new Error('Некорректный ответ GigaChat embeddings');
  }

  return items
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((item) => {
      if (!Array.isArray(item.embedding) || item.embedding.length === 0) {
        throw new Error('Пустой embedding в ответе GigaChat');
      }
      return item.embedding;
    });
}

/**
 * @param {{ authKey: string, scope: string, model: string, insecureSsl?: boolean, batchSize?: number }} config
 * @param {string[]} texts
 */
export async function embedDocuments(config, texts) {
  const batchSize = config.batchSize ?? 16;
  const vectors = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchVectors = await embedTexts(config, batch);
    vectors.push(...batchVectors);
  }

  return vectors;
}
