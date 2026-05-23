/**
 * Локальные эмбеддинги без внешнего API (работает из РФ без VPN).
 * Модель: multilingual-e5-base, размерность 768.
 */
import { pipeline } from '@xenova/transformers';

const DEFAULT_MODEL = 'Xenova/multilingual-e5-base';
const DEFAULT_DIM = 768;

/** @type {import('@xenova/transformers').FeatureExtractionPipeline | null} */
let extractor = null;

/**
 * @param {string} model
 */
async function getExtractor(model) {
  if (!extractor) {
    console.log(
      `[embed] Загрузка модели ${model} (первый раз может занять 1–3 мин)…`,
    );
    extractor = await pipeline('feature-extraction', model, { quantized: true });
  }
  return extractor;
}

/**
 * @param {{ model?: string }} [config]
 * @param {string[]} texts
 * @returns {Promise<{ vectors: number[][], model: string, dimension: number }>}
 */
export async function embedDocumentsLocal(texts, config = {}) {
  const model = config.model?.trim() || process.env.LOCAL_EMBEDDING_MODEL?.trim() || DEFAULT_MODEL;
  const pipe = await getExtractor(model);

  const vectors = [];
  for (let i = 0; i < texts.length; i++) {
    const input = texts[i].startsWith('passage:') ? texts[i] : `passage: ${texts[i]}`;
    const output = await pipe(input, { pooling: 'mean', normalize: true });
    vectors.push(Array.from(output.data));

    if ((i + 1) % 10 === 0 || i === texts.length - 1) {
      console.log(`  локально: ${i + 1}/${texts.length}`);
    }
  }

  const dimension = vectors[0]?.length ?? DEFAULT_DIM;
  return { vectors, model, dimension };
}

/**
 * Эмбеддинг одного вопроса (префикс query: для E5).
 * @param {string} text
 * @param {{ model?: string }} [config]
 * @returns {Promise<number[]>}
 */
export async function embedQueryLocal(text, config = {}) {
  const model = config.model?.trim() || process.env.LOCAL_EMBEDDING_MODEL?.trim() || DEFAULT_MODEL;
  const pipe = await getExtractor(model);
  const input = text.startsWith('query:') ? text : `query: ${text}`;
  const output = await pipe(input, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}
