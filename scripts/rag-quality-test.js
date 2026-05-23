/**
 * Проверка качества RAG: 10 вопросов → поиск + GigaChat.
 * Запуск: node scripts/rag-quality-test.js
 */
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { config } from '../src/config/env.js';
import { buildSystemPrompt } from '../src/config/aiSystemPrompt.js';
import { createChatCompletion } from '../src/services/gigachatClient.js';
import { getSupabase } from '../src/lib/supabase.js';
import { embedQueryLocal } from './localEmbeddings.js';
import { formatRagContext } from '../src/services/rag.js';
import { getCategories } from '../src/services/catalog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env'), override: true });

const mockCtx = { from: { id: 0, username: 'quality-test' } };

/** @type {Array<{ id: number, question: string, type: string, expectFragment: string, expectAnswer: string }>} */
const CASES = [
  {
    id: 1,
    question: 'Сколько стоит первичная консультация?',
    type: 'База: цены FAQ',
    expectFragment: 'консультац|3 500|3500',
    expectAnswer: 'от 3 500|3500|45 мин',
  },
  {
    id: 2,
    question: 'Как записаться на консультацию к юристу?',
    type: 'База: заявка',
    expectFragment: 'заявк|Записаться|кнопк',
    expectAnswer: 'заявк|Записаться|менеджер',
  },
  {
    id: 3,
    question: 'Какие направления права вы консультируете?',
    type: 'База: услуги',
    expectFragment: 'семейн|трудов|недвижим|направлен',
    expectAnswer: 'семейн|трудов|недвижим|долг|бизнес|наследств',
  },
  {
    id: 4,
    question: 'Сколько стоят семейные споры?',
    type: 'База: цены FAQ',
    expectFragment: 'семейн|15 000|15000',
    expectAnswer: '15 000|15000|семейн',
  },
  {
    id: 5,
    question: 'Берёте ли вы уголовные дела?',
    type: 'База: ограничения',
    expectFragment: 'уголов|не ведём|не ведем|ограничен',
    expectAnswer: 'не ведём|не ведем|уголовн',
  },
  {
    id: 6,
    question: 'Когда со мной свяжется менеджер после заявки?',
    type: 'База: регламент',
    expectFragment: 'менеджер|рабоч|срок|связ',
    expectAnswer: 'рабоч|менеджер|срок|день',
  },
  {
    id: 7,
    question: 'Как приготовить борщ по классическому рецепту?',
    type: 'Вне базы (кулинария)',
    expectFragment: '.',
    expectAnswer: 'нет|отсутств|не найден|материал|не консультиру|Правовой компас|направлен',
  },
  {
    id: 8,
    question: 'Сколько стоит оформление визы в США?',
    type: 'Вне базы (миграция)',
    expectFragment: 'миграц|не ведём|не ведем|ограничен|.',
    expectAnswer: 'нет|отсутств|не найден|материал|миграц|не ведём|не ведем',
  },
  {
    id: 9,
    question: 'Сколько стоит подготовка претензии?',
    type: 'База: цены',
    expectFragment: 'претенз|5 000|5000',
    expectAnswer: '5 000|5000|претенз',
  },
  {
    id: 10,
    question: 'Можно ли оплатить консультацию картой прямо в этом чате?',
    type: 'База: ограничения',
    expectFragment: 'оплат|чат|не принима',
    expectAnswer: 'не принима|оплат.*чат|менеджер|заявк',
  },
];

function formatEmbedding(vector) {
  return `[${vector.map((v) => Number(v).toFixed(6)).join(',')}]`;
}

function preview(text, n = 100) {
  return String(text).replace(/\s+/g, ' ').trim().slice(0, n);
}

function matches(text, pattern) {
  return new RegExp(pattern, 'i').test(text);
}

async function retrieve(query) {
  const vector = await embedQueryLocal(query.trim());
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('match_kb_chunks', {
    query_embedding: formatEmbedding(vector),
    match_count: config.ragMatchCount,
    filter: {},
  });
  if (error) throw new Error(error.message);

  const raw = (Array.isArray(data) ? data : []).map((row) => ({
    id: row.id,
    content: row.content,
    metadata: row.metadata ?? {},
    similarity: Number(row.similarity) || 0,
  }));

  const chunks = raw.filter((r) => r.similarity >= config.ragMinSimilarity);
  return { raw, chunks };
}

function assessFragment(chunks, expectFragment) {
  if (!chunks.length) {
    return expectFragment === '.' ? 'OK (пусто ожидаемо)' : 'ПЛОХО (ничего не найдено)';
  }
  const top = chunks[0];
  const text = `${top.content} ${JSON.stringify(top.metadata)}`;
  if (expectFragment === '.') {
    return top.similarity < 0.55
      ? 'OK (низкая релевантность)'
      : `СОМНИТЕЛЬНО (sim=${top.similarity.toFixed(3)}, есть шум)`;
  }
  return matches(text, expectFragment)
    ? `OK (sim=${top.similarity.toFixed(3)})`
    : `ПЛОХО (sim=${top.similarity.toFixed(3)}, топ не по теме)`;
}

function assessAnswer(answer, expectAnswer, type) {
  const ok = matches(answer, expectAnswer);
  if (type.includes('Вне базы')) {
    const honest = /нет|отсутств|не найден|материал|не консультиру|не могу|не располага/i.test(
      answer,
    );
    const noHallucination = !/борщ|виз.*\d|рецепт/i.test(answer);
    if (honest && noHallucination) return 'OK (честный отказ)';
    if (!honest) return 'ПЛОХО (не признал отсутствие в базе)';
    return 'СОМНИТЕЛЬНО';
  }
  return ok ? 'OK' : 'ПЛОХО (ответ без ключевых фактов из базы)';
}

function tsvCell(s) {
  return String(s ?? '')
    .replace(/\t/g, ' ')
    .replace(/\r?\n/g, ' ')
    .trim();
}

async function main() {
  console.log('Прогрев эмбеддингов…');
  await embedQueryLocal('тест');

  const categories = await getCategories();
  const categoryLabels = categories.map((c) => c.label);

  const results = [];

  for (const tc of CASES) {
    console.log(`\n--- #${tc.id} ${tc.question} ---`);
    const { raw, chunks } = await retrieve(tc.question);
    const fragVerdict = assessFragment(chunks, tc.expectFragment);
    const topPreview = chunks[0]
      ? preview(chunks[0].content, 180)
      : '(нет фрагментов выше порога)';
    const topSim = chunks[0]?.similarity?.toFixed(3) ?? '—';
    const topType = chunks[0]?.metadata?.content_type ?? '—';

    const contextText = formatRagContext(chunks);
    const systemPrompt = buildSystemPrompt(categoryLabels, contextText);

    let answer = '';
    let answerVerdict = '';
    try {
      answer = await createChatCompletion({
        systemPrompt,
        userMessage: tc.question,
        history: [],
      });
      answerVerdict = assessAnswer(answer, tc.expectAnswer, tc.type);
      console.log(`RAG: ${fragVerdict} | Ответ: ${answerVerdict}`);
      console.log(`Топ: sim=${topSim} type=${topType}`);
      console.log(`Ответ: ${preview(answer, 200)}`);
    } catch (e) {
      answer = `ОШИБКА: ${e.message}`;
      answerVerdict = 'ОШИБКА API';
      console.error(e.message);
    }

    results.push({
      ...tc,
      topSim,
      topType,
      topPreview,
      fragmentsCount: chunks.length,
      rawCount: raw.length,
      fragVerdict,
      answer,
      answerVerdict,
    });

    await new Promise((r) => setTimeout(r, 800));
  }

  console.log('\n\n========== TSV ДЛЯ EXCEL (скопируйте блок ниже) ==========\n');
  const header = [
    '№',
    'Тип',
    'Вопрос',
    'Найдено фрагментов',
    'Sim топ-1',
    'Тип топ-1',
    'Оценка поиска',
    'Превью топ-фрагмента',
    'Оценка ответа',
    'Ответ модели',
  ].join('\t');

  console.log(header);
  for (const r of results) {
    console.log(
      [
        r.id,
        r.type,
        r.question,
        r.fragmentsCount,
        r.topSim,
        r.topType,
        r.fragVerdict,
        r.topPreview,
        r.answerVerdict,
        r.answer,
      ]
        .map(tsvCell)
        .join('\t'),
    );
  }

  const bad = results.filter(
    (r) => r.fragVerdict.startsWith('ПЛОХО') || r.answerVerdict.startsWith('ПЛОХО'),
  );
  console.log('\n========== ПРОБЛЕМНЫЕ СЛУЧАИ ==========');
  for (const r of bad.slice(0, 5)) {
    console.log(`#${r.id}: поиск=${r.fragVerdict}; ответ=${r.answerVerdict}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
