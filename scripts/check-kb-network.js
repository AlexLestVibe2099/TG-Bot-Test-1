/**
 * Проверка: IP терминала и доступность Groq Embeddings API.
 * Запуск: npm run check:kb-network
 */
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { fetch as undiciFetch, ProxyAgent } from 'undici';
import { resolveGroqApiKey, getGroqEmbeddingModel } from './groqEmbeddings.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env'), override: true });

function getDispatcher() {
  const proxy = process.env.HTTPS_PROXY?.trim() || process.env.HTTP_PROXY?.trim();
  if (!proxy) return undefined;
  console.log(`Прокси: ${proxy}`);
  return new ProxyAgent(proxy);
}

async function main() {
  const dispatcher = getDispatcher();

  console.log('--- IP терминала (ipinfo.io) ---');
  try {
    const ipRes = await undiciFetch('https://ipinfo.io/json', {
      dispatcher,
      signal: AbortSignal.timeout(15_000),
    });
    const ip = await ipRes.json();
    console.log(`Страна: ${ip.country ?? '?'} (${ip.city ?? ''})`);
    console.log(`IP: ${ip.ip ?? '?'}`);
  } catch (e) {
    console.log('Не удалось определить IP:', e.message);
  }

  console.log('\n--- Тест Groq embeddings ---');
  try {
    const key = resolveGroqApiKey();
    const model = getGroqEmbeddingModel();
    const res = await undiciFetch('https://api.groq.com/openai/v1/embeddings', {
      method: 'POST',
      dispatcher,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        input: ['search_document: тест'],
        encoding_format: 'float',
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json();
    if (res.ok) {
      const dim = data?.data?.[0]?.embedding?.length ?? '?';
      console.log(`OK, модель: ${data.model ?? model}, размерность: ${dim}`);
    } else {
      console.log(`Ошибка ${res.status}: ${data?.error?.message ?? JSON.stringify(data)}`);
      if (res.status === 403) {
        console.log('\n⚠ Groq недоступен из вашего региона для терминала.');
        console.log('  npm run ingest:kb с EMBEDDING_PROVIDER=auto переключится на локальные эмбеддинги.');
        console.log('  Либо VPN (TUN) / HTTPS_PROXY в .env для Groq.');
      }
    }
  } catch (e) {
    console.log('Ошибка:', e.message);
  }
}

main();
