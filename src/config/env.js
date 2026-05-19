import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../../.env');

// override: true — .env всегда важнее случайного BOT_TOKEN в окружении (Cursor/терминал)
const result = dotenv.config({ path: envPath, override: true });

if (result.error && result.error.code !== 'ENOENT') {
  console.warn('[env] Не удалось прочитать .env:', result.error.message);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(`Переменная окружения ${name} не задана. Проверьте файл .env`);
  }
  return value.trim();
}

function parseChatIds(raw) {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
}

export const config = {
  botToken: requireEnv('BOT_TOKEN'),
  supabaseUrl: requireEnv('SUPABASE_URL'),
  supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  managerChatIds: parseChatIds(process.env.MANAGER_CHAT_IDS),
  catalogCacheTtlMs: Number(process.env.CATALOG_CACHE_TTL_MS) || 5 * 60 * 1000,
  gigachatAuthKey: process.env.GIGACHAT_AUTH_KEY?.trim() || null,
  gigachatModel: process.env.GIGACHAT_MODEL?.trim() || 'GigaChat',
  gigachatScope: process.env.GIGACHAT_SCOPE?.trim() || 'GIGACHAT_API_PERS',
  gigachatTemperature: Number(process.env.GIGACHAT_TEMPERATURE) || 0.3,
  gigachatMaxTokens: Number(process.env.GIGACHAT_MAX_TOKENS) || 300,
  gigachatInsecureSsl: process.env.GIGACHAT_INSECURE_SSL !== 'false',
};
