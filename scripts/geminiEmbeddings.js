/**
 * Эмбеддинги Google Gemini API (REST v1beta).
 * Поддержка HTTPS_PROXY / HTTP_PROXY для VPN (терминал не всегда идёт через системный VPN).
 */
import { fetch as undiciFetch, ProxyAgent } from 'undici';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function getDispatcher() {
  const proxy = process.env.HTTPS_PROXY?.trim() || process.env.HTTP_PROXY?.trim();
  if (!proxy) return undefined;
  return new ProxyAgent(proxy);
}

/**
 * @param {string} url
 * @param {RequestInit} options
 */
async function geminiFetch(url, options = {}) {
  const dispatcher = getDispatcher();
  return undiciFetch(url, dispatcher ? { ...options, dispatcher } : options);
}

/**
 * @param {number[]} values
 */
function normalizeVector(values) {
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  if (!norm) return values;
  return values.map((v) => v / norm);
}

/**
 * @param {string} apiKey
 * @param {string} model
 * @param {string} text
 * @param {number} outputDimensionality
 */
async function embedOne(apiKey, model, text, outputDimensionality) {
  const url = `${API_BASE}/models/${model}:embedContent`;

  const response = await geminiFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      taskType: 'RETRIEVAL_DOCUMENT',
      outputDimensionality,
      content: { parts: [{ text }] },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw apiError(response.status, data);
  }

  const values = data?.embedding?.values;
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('Gemini embedContent: пустой embedding');
  }

  return outputDimensionality < 3072 ? normalizeVector(values) : values;
}

/**
 * @param {string} apiKey
 * @param {string} model
 * @param {string[]} texts
 * @param {number} outputDimensionality
 */
async function embedBatch(apiKey, model, texts, outputDimensionality) {
  const url = `${API_BASE}/models/${model}:batchEmbedContents`;

  const response = await geminiFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        taskType: 'RETRIEVAL_DOCUMENT',
        outputDimensionality,
        content: { parts: [{ text }] },
      })),
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw apiError(response.status, data);
  }

  const embeddings = data?.embeddings;
  if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
    throw new Error('Gemini batchEmbedContents: некорректный ответ');
  }

  return embeddings.map((item) => {
    const values = item?.values;
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('Gemini batchEmbedContents: пустой embedding');
    }
    return outputDimensionality < 3072 ? normalizeVector(values) : values;
  });
}

/**
 * @param {number} status
 * @param {unknown} data
 */
export function apiError(status, data) {
  const message =
    typeof data === 'object' && data !== null && 'error' in data
      ? /** @type {{ error?: { message?: string } }} */ (data).error?.message
      : null;

  if (status === 400 && /location is not supported/i.test(message ?? '')) {
    const err = new Error(
      'Gemini API: запрос идёт не через VPN (браузер — Польша, терминал — возможно РФ).',
    );
    err.code = 'GEMINI_LOCATION_BLOCKED';
    return err;
  }

  if (status === 404) {
    return new Error(
      `${message ?? 'Модель не найдена'}. Укажите GEMINI_EMBEDDING_MODEL=gemini-embedding-001 в .env`,
    );
  }

  return new Error(message ?? `Gemini API error ${status}`);
}

export function isGeminiLocationError(err) {
  return err?.code === 'GEMINI_LOCATION_BLOCKED' || /location is not supported/i.test(err?.message ?? '');
}

/**
 * @param {{ apiKey: string, model: string, batchSize?: number, outputDimensionality?: number }} config
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export async function embedDocuments(config, texts) {
  if (texts.length === 0) return [];

  const model = config.model.replace(/^models\//, '');
  const outputDimensionality = config.outputDimensionality ?? 768;
  const batchSize = config.batchSize ?? 16;
  const vectors = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    if (batch.length === 1) {
      vectors.push(await embedOne(config.apiKey, model, batch[0], outputDimensionality));
      continue;
    }

    try {
      const batchVectors = await embedBatch(
        config.apiKey,
        model,
        batch,
        outputDimensionality,
      );
      vectors.push(...batchVectors);
    } catch {
      for (const text of batch) {
        vectors.push(await embedOne(config.apiKey, model, text, outputDimensionality));
      }
    }
  }

  return vectors;
}

/**
 * @returns {string}
 */
export function resolveGeminiApiKey() {
  const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (!key) {
    throw new Error(
      'Задайте GEMINI_API_KEY в .env — ключ: https://aistudio.google.com/apikey',
    );
  }
  return key;
}
