import { config } from '../config/env.js';
import { getSupabase } from '../lib/supabase.js';
import { embedQueryLocal } from '../../scripts/localEmbeddings.js';

/**
 * @param {number[]} vector
 */
function formatEmbedding(vector) {
  return `[${vector.map((v) => Number(v).toFixed(6)).join(',')}]`;
}

export function isRagEnabled() {
  return config.ragEnabled;
}

/** Прогрев модели при старте бота */
export async function warmupRag() {
  await embedQueryLocal('тест');
}

/**
 * @typedef {{ id: string, document_id: string, content: string, metadata: Record<string, unknown>, similarity: number }} RagChunk
 */

/**
 * @param {RagChunk[]} chunks
 */
export function formatRagContext(chunks) {
  if (chunks.length === 0) {
    return '(Релевантные фрагменты в базе знаний не найдены.)';
  }

  return chunks
    .map((chunk, index) => {
      const meta = chunk.metadata ?? {};
      const lines = [`--- Фрагмент ${index + 1} (релевантность ${(chunk.similarity * 100).toFixed(0)}%) ---`];
      if (meta.section) lines.push(`Раздел: ${meta.section}`);
      if (meta.subsection) lines.push(`Подраздел: ${meta.subsection}`);
      if (meta.question) lines.push(`Вопрос: ${meta.question}`);
      lines.push(chunk.content);
      return lines.join('\n');
    })
    .join('\n\n');
}

/**
 * @param {string} text
 * @param {number} maxLen
 */
function preview(text, maxLen = 120) {
  return String(text).replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

/**
 * @param {import('telegraf').Context} ctx
 * @param {string} query
 * @param {RagChunk[]} chunks
 * @param {RagChunk[]} [rawChunks] — все результаты RPC до фильтра по порогу
 */
export function logRagResults(ctx, query, chunks, rawChunks = chunks) {
  const userId = ctx.from?.id ?? '?';
  const username = ctx.from?.username ? `@${ctx.from.username}` : '';

  console.log(
    `[RAG] user=${userId}${username ? ` ${username}` : ''} question="${preview(query, 150)}" ` +
      `matched=${chunks.length}${rawChunks.length !== chunks.length ? ` (из ${rawChunks.length} до порога)` : ''}`,
  );

  if (rawChunks.length === 0) {
    console.log('[RAG]   фрагменты не найдены');
    return;
  }

  for (const [i, chunk] of rawChunks.entries()) {
    const meta = chunk.metadata ?? {};
    const inContext = chunks.some((c) => c.id === chunk.id);
    const tag = inContext ? '→ в промпт' : '→ отсечён порогом';
    console.log(
      `[RAG]   #${i + 1} ${tag} sim=${chunk.similarity.toFixed(3)} ` +
        `type=${meta.content_type ?? '—'} section=${meta.section ?? '—'}`,
    );
    if (meta.subsection) {
      console.log(`[RAG]       подраздел: ${preview(String(meta.subsection), 100)}`);
    }
    console.log(`[RAG]       ${preview(chunk.content, 200)}`);
  }
}

/**
 * @param {import('telegraf').Context} ctx
 * @param {string} query
 */
export async function retrieveForQuestion(ctx, query) {
  const supabase = getSupabase();
  const matchCount = config.ragMatchCount;
  const minSimilarity = config.ragMinSimilarity;

  const vector = await embedQueryLocal(query.trim());
  const { data, error } = await supabase.rpc('match_kb_chunks', {
    query_embedding: formatEmbedding(vector),
    match_count: matchCount,
    filter: {},
  });

  if (error) {
    throw new Error(error.message);
  }

  const rawChunks = (Array.isArray(data) ? data : []).map((row) => ({
    id: row.id,
    document_id: row.document_id,
    content: row.content,
    metadata: row.metadata ?? {},
    similarity: Number(row.similarity) || 0,
  }));

  const chunks = rawChunks.filter((row) => row.similarity >= minSimilarity);

  logRagResults(ctx, query, chunks, rawChunks);

  return {
    chunks,
    contextText: formatRagContext(chunks),
  };
}
