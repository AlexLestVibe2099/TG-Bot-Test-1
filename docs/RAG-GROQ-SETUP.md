# RAG: индексация через Groq

Эмбеддинги: **Groq** + модель `nomic-embed-text-v1_5` (768 измерений).  
Чат бота по-прежнему через **GigaChat** (`GIGACHAT_*`).

## 1. Ключ Groq

1. [console.groq.com](https://console.groq.com) → API Keys → Create.
2. В `.env`:

```env
GROQ_API_KEY=gsk_...
GROQ_EMBEDDING_MODEL=nomic-embed-text-v1_5
GROQ_EMBEDDING_DIMENSION=768
```

Опционально, если VPN даёт локальный прокси:

```env
HTTPS_PROXY=http://127.0.0.1:ПОРТ
```

## 2. Supabase

SQL Editor → выполните `supabase/rag_schema.sql` (колонка `embedding vector(768)`).

Если раньше была другая размерность — переиндексируйте после миграции схемы.

## 3. Проверка сети

```bash
npm run check:kb-network
```

Должно быть `OK` для Groq embeddings. При `403 Forbidden` — терминал не через VPN: включите TUN/«весь трафик» или `HTTPS_PROXY`.

## 4. Индексация

В `.env` (по умолчанию — работает из РФ без VPN):

```env
EMBEDDING_PROVIDER=auto
EMBEDDING_FALLBACK_LOCAL=true
```

При `403` от Groq скрипт автоматически переключится на локальную модель.

Положите `Правовой компас — контекст компании.docx` в корень проекта (или `KB_DOCX_PATH`).

```bash
npm run ingest:kb
```

В конце: `Готово. Загружено фрагментов: N`.

## 5. Проверка в Supabase

Table Editor → `kb_chunks` — строки с `content` и заполненным `embedding`.

## 6. RAG в боте

После индексации бот при каждом вопросе ищет фрагменты в `kb_chunks` и передаёт их в промпт GigaChat.

В `.env`:
```env
RAG_ENABLED=true
RAG_MATCH_COUNT=5
RAG_MIN_SIMILARITY=0.45
```

В консоли при вопросе: `[RAG] user=… question="…" matched=N` и список фрагментов.

Перезапустите бота: `npm start`.

## Ошибки

| Симптом | Решение |
|--------|---------|
| `GROQ_API_KEY не задан` | Добавьте ключ в `.env` |
| `403` / Forbidden | VPN для терминала или `HTTPS_PROXY` |
| `401` | Неверный или отозванный ключ |
| `размерность вектора` | `GROQ_EMBEDDING_DIMENSION=768`, схема `vector(768)` |
| `429` | Лимит rate limit — подождите и повторите |
