import { config } from '../config/env.js';
import { getSupabase } from '../lib/supabase.js';

/** @typedef {{ id: string, label: string }} Category */
/** @typedef {{ id: string, name: string, role: string, telegram_chat_id: number | null }} Manager */

let categoriesCache = /** @type {Category[] | null} */ (null);
let managersCache = /** @type {Manager[] | null} */ (null);
let cacheTimestamp = 0;

function isCacheValid() {
  return categoriesCache && managersCache && Date.now() - cacheTimestamp < config.catalogCacheTtlMs;
}

function invalidateCache() {
  categoriesCache = null;
  managersCache = null;
  cacheTimestamp = 0;
}

/** @returns {Promise<Category[]>} */
export async function getCategories(force = false) {
  if (!force && isCacheValid()) return categoriesCache;

  const { data, error } = await getSupabase()
    .from('categories')
    .select('id, label')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`Категории: ${error.message}`);

  categoriesCache = data ?? [];
  cacheTimestamp = Date.now();
  return categoriesCache;
}

/** @returns {Promise<Manager[]>} */
export async function getManagers(force = false) {
  if (!force && isCacheValid()) return managersCache;

  const { data, error } = await getSupabase()
    .from('managers')
    .select('id, name, role, telegram_chat_id')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`Менеджеры: ${error.message}`);

  managersCache = data ?? [];
  if (!categoriesCache) await getCategories(true);
  else cacheTimestamp = Date.now();
  return managersCache;
}

/** @param {string} id */
export async function findCategoryById(id) {
  const categories = await getCategories();
  return categories.find((c) => c.id === id) ?? null;
}

export async function getManagerLine() {
  const managers = await getManagers();
  if (!managers.length) return '—';
  return managers.map((m) => `• ${m.name} — ${m.role}`).join('\n');
}

/** Чаты для уведомлений: из .env + telegram_chat_id менеджеров в БД */
export async function getNotificationChatIds() {
  const managers = await getManagers();
  const fromDb = managers
    .map((m) => m.telegram_chat_id)
    .filter((id) => id != null && Number.isFinite(Number(id)))
    .map(Number);
  return [...new Set([...config.managerChatIds, ...fromDb])];
}

export async function warmupCatalog() {
  invalidateCache();
  const [categories, managers] = await Promise.all([getCategories(true), getManagers(true)]);
  return { categories: categories.length, managers: managers.length };
}

export async function verifySupabaseConnection() {
  const { error } = await getSupabase().from('categories').select('id').limit(1);
  if (error) throw new Error(error.message);
}
