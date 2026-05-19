import 'dotenv/config';

function requireEnv(name) {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(`Переменная окружения ${name} не задана. Скопируйте .env.example в .env`);
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
  managerChatIds: parseChatIds(process.env.MANAGER_CHAT_IDS),
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() || null,
  openaiModel: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
};
