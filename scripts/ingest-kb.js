/**
 * Индексация базы знаний: .docx → чанки → эмбеддинги → Supabase pgvector.
 *
 * Провайдеры (EMBEDDING_PROVIDER):
 *   auto  — Groq, при 403 из РФ → локально (по умолчанию)
 *   groq  — только Groq (нужен VPN/прокси)
 *   local — только локальная модель, без API
 *
 * Запуск: npm run ingest:kb
 */
import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import mammoth from 'mammoth';
import {
  embedDocuments,
  resolveGroqApiKey,
  getGroqEmbeddingDimension,
  getGroqEmbeddingModel,
  isGroqForbiddenError,
} from './groqEmbeddings.js';
import { embedDocumentsLocal } from './localEmbeddings.js';
import { chunkKnowledgeBaseText, formatChunkForEmbedding } from './kbChunker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

dotenv.config({ path: resolve(PROJECT_ROOT, '.env'), override: true });

const DOCUMENT_ID = 'pravovoy-kompas-kb';
const DOCUMENT_TITLE = 'Правовой компас — контекст компании';
const DEFAULT_DOCX = resolve(PROJECT_ROOT, `${DOCUMENT_TITLE}.docx`);
const DESKTOP_DOCX = resolve(
  process.env.USERPROFILE ?? process.env.HOME ?? '',
  'Desktop',
  `${DOCUMENT_TITLE}.docx`,
);

/** Supabase/PostgREST обрывает соединение при batch ≥2 с embedding+текстом */
const INSERT_BATCH = Number(process.env.KB_INSERT_BATCH ?? 1);
const MAX_EMBED_CHARS = 6_000;
const SCHEMA_PROBE_INDEX = -1;

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Переменная ${name} не задана в .env`);
  }
  return value;
}

function getEmbeddingProvider() {
  return (process.env.EMBEDDING_PROVIDER?.trim() || 'auto').toLowerCase();
}

function allowLocalFallback() {
  const v = process.env.EMBEDDING_FALLBACK_LOCAL?.trim().toLowerCase();
  return v !== 'false' && v !== '0';
}

function resolveDocxPath() {
  const fromEnv = process.env.KB_DOCX_PATH?.trim();
  if (fromEnv) {
    const p = resolve(fromEnv);
    if (!existsSync(p)) throw new Error(`KB_DOCX_PATH: файл не найден: ${p}`);
    return p;
  }
  if (existsSync(DEFAULT_DOCX)) return DEFAULT_DOCX;
  if (existsSync(DESKTOP_DOCX)) return DESKTOP_DOCX;
  throw new Error(
    `Документ не найден. Положите "${DOCUMENT_TITLE}.docx" в корень проекта или задайте KB_DOCX_PATH`,
  );
}

function fileHash(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

async function loadDocxText(path) {
  const buffer = readFileSync(path);
  const { value } = await mammoth.extractRawText({ buffer });
  return value.trim();
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function clearDocumentChunks(supabase, documentId) {
  const { error } = await supabase.from('kb_chunks').delete().eq('document_id', documentId);
  if (error) throw new Error(`Ошибка очистки чанков: ${error.message}`);
}

function formatSupabaseError(error, context) {
  const parts = [context, error.message];
  if (error.details) parts.push(String(error.details).split('\n')[0]);
  if (error.hint) parts.push(error.hint);
  return parts.filter(Boolean).join(' — ');
}

function isRetryableFetchError(error) {
  return /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|EPIPE/i.test(
    `${error?.message ?? ''} ${error?.details ?? ''}`,
  );
}

/** Компактный формат для pgvector — меньше JSON, стабильнее вставка */
function formatEmbedding(vector) {
  return `[${vector.map((v) => Number(v).toFixed(6)).join(',')}]`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Проверка vector(N) в Supabase до долгой индексации.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} expectedDim
 */
async function assertSupabaseEmbeddingDimension(supabase, expectedDim) {
  const { error: docError } = await supabase.from('kb_documents').upsert(
    {
      id: DOCUMENT_ID,
      title: DOCUMENT_TITLE,
      version: 'schema-probe',
      content_hash: 'probe',
      chunk_count: 0,
      status: 'active',
    },
    { onConflict: 'id' },
  );
  if (docError) {
    throw new Error(formatSupabaseError(docError, 'kb_documents'));
  }

  await supabase.from('kb_chunks').delete().eq('chunk_index', SCHEMA_PROBE_INDEX);

  const { error } = await supabase.from('kb_chunks').insert({
    document_id: DOCUMENT_ID,
    content: '__schema_probe__',
    embedding: formatEmbedding(new Array(expectedDim).fill(0)),
    metadata: { probe: true },
    chunk_index: SCHEMA_PROBE_INDEX,
  });

  await supabase.from('kb_chunks').delete().eq('chunk_index', SCHEMA_PROBE_INDEX);

  if (!error) return;

  const msg = error.message ?? '';
  if (/expected \d+ dimensions, not \d+/i.test(msg)) {
    const match = msg.match(/expected (\d+) dimensions, not (\d+)/i);
    const dbDim = match?.[1] ?? '?';
    const gotDim = match?.[2] ?? String(expectedDim);
    throw new Error(
      `Несовпадение размерности в Supabase: в БД vector(${dbDim}), эмбеддинги — ${gotDim}.\n` +
        `Откройте Supabase → SQL Editor → выполните файл supabase/rag_schema_migrate_to_768.sql\n` +
        `Затем снова: npm run ingest:kb`,
    );
  }

  throw new Error(formatSupabaseError(error, 'Проверка схемы kb_chunks'));
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} row
 */
async function insertOneChunk(supabase, row) {
  const payload = { ...row, embedding: formatEmbedding(row.embedding) };

  for (let attempt = 1; attempt <= 5; attempt++) {
    const { error } = await supabase.from('kb_chunks').insert(payload);
    if (!error) return;
    if (!isRetryableFetchError(error) || attempt === 5) {
      throw new Error(formatSupabaseError(error, `Чанк #${row.chunk_index}`));
    }
    await sleep(attempt * 800);
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object[]} rows
 */
async function insertChunksBatched(supabase, rows) {
  let inserted = 0;

  if (INSERT_BATCH > 1) {
    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      const batch = rows.slice(i, i + INSERT_BATCH);
      let lastError = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        const payload = batch.map((row) => ({
          ...row,
          embedding: formatEmbedding(row.embedding),
        }));
        const { error } = await supabase.from('kb_chunks').insert(payload);
        if (!error) {
          inserted += batch.length;
          console.log(`  Supabase: ${inserted}/${rows.length}`);
          lastError = null;
          break;
        }
        lastError = error;
        if (!isRetryableFetchError(error) || attempt === 3) break;
        await sleep(attempt * 1500);
      }

      if (lastError) {
        console.warn(`  batch ${INSERT_BATCH} не прошёл, вставка по одному…`);
        for (const row of batch) {
          await insertOneChunk(supabase, row);
          inserted += 1;
          if (inserted % 5 === 0 || inserted === rows.length) {
            console.log(`  Supabase: ${inserted}/${rows.length}`);
          }
        }
      }
    }
    return inserted;
  }

  for (const row of rows) {
    await insertOneChunk(supabase, row);
    inserted += 1;
    if (inserted % 10 === 0 || inserted === rows.length) {
      console.log(`  Supabase: ${inserted}/${rows.length}`);
    }
  }

  return inserted;
}

/**
 * @param {string} text
 */
function trimForEmbedding(text) {
  if (text.length <= MAX_EMBED_CHARS) return text;
  return `${text.slice(0, MAX_EMBED_CHARS - 1)}…`;
}

/**
 * @param {string[]} textsForEmbed
 */
async function buildEmbeddings(textsForEmbed) {
  const provider = getEmbeddingProvider();
  const expectedDim = getGroqEmbeddingDimension();

  if (provider === 'local') {
    console.log(`Локальные эмбеддинги (${textsForEmbed.length} фрагментов)…`);
    const { vectors, model, dimension } = await embedDocumentsLocal(textsForEmbed);
    return { vectors, modelName: model, expectedDim: dimension };
  }

  const groqModel = getGroqEmbeddingModel();

  async function runGroq() {
    const apiKey = resolveGroqApiKey();
    const vectors = await embedDocuments(
      {
        apiKey,
        model: groqModel,
        batchSize: Number(process.env.GROQ_EMBEDDING_BATCH ?? 32),
      },
      textsForEmbed,
    );
    return { vectors, modelName: groqModel, expectedDim };
  }

  if (provider === 'groq') {
    console.log(`Эмбеддинги Groq (${textsForEmbed.length} фрагментов)…`);
    return runGroq();
  }

  // auto: Groq → при 403 → local
  try {
    console.log(`Эмбеддинги Groq (${textsForEmbed.length} фрагментов)…`);
    return await runGroq();
  } catch (err) {
    if (!isGroqForbiddenError(err) || !allowLocalFallback()) {
      throw err;
    }
    console.warn('\n⚠ Groq недоступен из терминала (403 / регион RU).');
    console.warn('  Переключаюсь на локальные эмбеддинги (без VPN и API)…\n');
    const { vectors, model, dimension } = await embedDocumentsLocal(textsForEmbed);
    return { vectors, modelName: model, expectedDim: dimension };
  }
}

async function main() {
  const docxPath = resolveDocxPath();
  const hash = fileHash(docxPath);
  const version = process.env.KB_VERSION?.trim() || new Date().toISOString().slice(0, 10);
  const provider = getEmbeddingProvider();

  console.log(`Файл: ${docxPath}`);
  console.log(`Версия: ${version}`);
  console.log(`SHA-256: ${hash.slice(0, 16)}…`);
  console.log(`Провайдер: ${provider}`);

  const supabase = createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  );

  const schemaDim = getGroqEmbeddingDimension();
  console.log(`Проверка Supabase (vector ${schemaDim})…`);
  await assertSupabaseEmbeddingDimension(supabase, schemaDim);

  console.log('Загрузка .docx…');
  const rawText = await loadDocxText(docxPath);
  if (!rawText) throw new Error('Документ пустой или не удалось извлечь текст');

  console.log('Нарезка на фрагменты…');
  const chunks = await chunkKnowledgeBaseText(rawText);
  if (chunks.length === 0) {
    throw new Error('Не получено ни одного фрагмента — проверьте структуру документа');
  }

  const textsForEmbed = chunks.map((c) => trimForEmbedding(formatChunkForEmbedding(c)));
  const { vectors, modelName, expectedDim } = await buildEmbeddings(textsForEmbed);

  if (vectors.length !== chunks.length) {
    throw new Error('Число векторов не совпадает с числом фрагментов');
  }

  const dim = vectors[0]?.length ?? 0;
  if (dim !== expectedDim) {
    throw new Error(
      `Размерность вектора ${dim}, ожидалось ${expectedDim}. ` +
        `Обновите vector(${dim}) в supabase/rag_schema.sql`,
    );
  }

  console.log('Запись в Supabase…');
  await clearDocumentChunks(supabase, DOCUMENT_ID);

  const rows = chunks.map((chunk, index) => ({
    document_id: DOCUMENT_ID,
    content: chunk.content,
    embedding: vectors[index],
    metadata: { ...chunk.metadata, embedding_model: modelName },
    chunk_index: index,
  }));

  const inserted = await insertChunksBatched(supabase, rows);

  const { error: docError } = await supabase.from('kb_documents').upsert(
    {
      id: DOCUMENT_ID,
      title: DOCUMENT_TITLE,
      version,
      content_hash: hash,
      chunk_count: inserted,
      status: 'active',
      indexed_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (docError) throw new Error(`Ошибка kb_documents: ${docError.message}`);

  console.log('');
  console.log(`Готово. Загружено фрагментов: ${inserted} (модель: ${modelName})`);
}

main().catch((err) => {
  let msg = err.message;
  if (isGroqForbiddenError(err)) {
    msg +=
      '\n\nСовет: EMBEDDING_PROVIDER=auto в .env (переключение на локальные при 403).' +
      '\nИли EMBEDDING_PROVIDER=local — сразу без Groq.' +
      '\nДля Groq: VPN (TUN) или HTTPS_PROXY в .env';
  }
  if (/api key|GROQ_API_KEY|401/i.test(msg)) {
    msg += '\nПроверьте GROQ_API_KEY: https://console.groq.com/keys';
  }
  console.error('Ошибка индексации:', msg);
  process.exit(1);
});
