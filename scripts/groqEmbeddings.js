/**
 * Эмбеддинги Groq (OpenAI-совместимый API).
 * Модель: nomic-embed-text-v1_5, размерность 768.
 *
 * https://console.groq.com/docs/embeddings
 */
import { fetch as undiciFetch, ProxyAgent } from 'undici';

const API_URL = 'https://api.groq.com/openai/v1/embeddings';
const DEFAULT_MODEL = 'nomic-embed-text-v1_5';
const DEFAULT_DIM = 768;

function getDispatcher() {
  const proxy = process.env.HTTPS_PROXY?.trim() || process.env.HTTP_PROXY?.trim();
  if (!proxy) return undefined;
  return new ProxyAgent(proxy);
}

export function resolveGroqApiKey() {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) {
    throw new Error('GROQ_API_KEY не задан в .env (https://console.groq.com/keys)');
  }
  return key;
}

/**
 * @param {unknown} err
 */
export function isGroqForbiddenError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return /403|forbidden|not available in your region/i.test(msg);
}

function prefixForTask(text, taskType) {
  if (taskType === 'query') {
    const p = 'search_query: ';
    return text.startsWith('search_query:') ? text : `${p}${text}`;
  }
  const p = 'search_document: ';
  return text.startsWith('search_document:') ? text : `${p}${text}`;
}

/**
 * @param {{ apiKey: string, model?: string, taskType?: 'document' | 'query' }} config
 * @param {string[]} inputs
 * @returns {Promise<number[][]>}
 */
export async function embedTexts(config, inputs) {
  if (inputs.length === 0) return [];

  const model = config.model?.trim() || process.env.GROQ_EMBEDDING_MODEL?.trim() || DEFAULT_MODEL;
  const taskType = config.taskType ?? 'document';
  const prefixed = inputs.map((t) => prefixForTask(t, taskType));

  const response = await undiciFetch(API_URL, {
    method: 'POST',
    dispatcher: getDispatcher(),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: prefixed,
      encoding_format: 'float',
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const data = await response.json();
  if (!response.ok) {
    const detail = data?.error?.message || data?.message || JSON.stringify(data);
    if (response.status === 403) {
      throw new Error(
        `Groq: доступ запрещён (403). ${detail} — включите VPN для терминала или HTTPS_PROXY в .env`,
      );
    }
    if (response.status === 401) {
      throw new Error(`Groq: неверный GROQ_API_KEY. ${detail}`);
    }
    throw new Error(`Groq embeddings ${response.status}: ${detail}`);
  }

  const items = data?.data;
  if (!Array.isArray(items) || items.length !== inputs.length) {
    throw new Error('Некорректный ответ Groq embeddings');
  }

  return items
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((item) => {
      if (!Array.isArray(item.embedding) || item.embedding.length === 0) {
        throw new Error('Пустой embedding в ответе Groq');
      }
      return item.embedding;
    });
}

/**
 * @param {{ apiKey: string, model?: string, batchSize?: number, taskType?: 'document' | 'query' }} config
 * @param {string[]} texts
 */
export async function embedDocuments(config, texts) {
  const batchSize = config.batchSize ?? Number(process.env.GROQ_EMBEDDING_BATCH ?? 32);
  const vectors = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchVectors = await embedTexts({ ...config, taskType: 'document' }, batch);
    vectors.push(...batchVectors);
    if (texts.length > batchSize) {
      console.log(`  Groq: ${Math.min(i + batch.length, texts.length)}/${texts.length}`);
    }
  }

  return vectors;
}

/**
 * Один запрос для поиска (RAG в боте).
 * @param {{ apiKey: string, model?: string }} config
 * @param {string} text
 */
export async function embedQuery(config, text) {
  const [vector] = await embedTexts({ ...config, taskType: 'query' }, [text]);
  return vector;
}

export function getGroqEmbeddingDimension() {
  return Number(process.env.GROQ_EMBEDDING_DIMENSION ?? DEFAULT_DIM);
}

export function getGroqEmbeddingModel() {
  return process.env.GROQ_EMBEDDING_MODEL?.trim() || DEFAULT_MODEL;
}
