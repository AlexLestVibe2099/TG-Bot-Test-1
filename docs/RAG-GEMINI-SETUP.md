# RAG: подключение Gemini Embeddings

Индексация базы знаний: **docx → Gemini → Supabase pgvector**.  
Ответы бота по-прежнему через **GigaChat**; Gemini нужен только для векторов (бесплатный tier в Google AI Studio).

---

## Шаг 1. Ключ Gemini API

1. Откройте [Google AI Studio → API Keys](https://aistudio.google.com/apikey).
2. Войдите в Google-аккаунт.
3. Нажмите **Create API key** → создайте ключ для проекта (можно без платного биллинга).
4. Скопируйте ключ (начинается с `AIza...`).

Не публикуйте ключ в Git — только в `.env`.

---

## Шаг 2. Переменные в `.env`

В корне проекта в файле `.env` добавьте:

```env
GEMINI_API_KEY=AIzaSy...ваш_ключ...

# опционально (значения по умолчанию уже подходят)
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_EMBEDDING_DIMENSION=768
```

Важно: модель **`text-embedding-004` больше не поддерживается** — используйте только `gemini-embedding-001`.

Остальное для индексации уже должно быть:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
GIGACHAT_AUTH_KEY=...   # для бота, не для ingest
```

---

## Шаг 3. Схема в Supabase

### Вариант А: таблиц RAG ещё нет

1. [Supabase Dashboard](https://supabase.com/dashboard) → ваш проект.
2. **SQL Editor** → **New query**.
3. Вставьте содержимое `supabase/rag_schema.sql`.
4. **Run**.

### Вариант Б: таблицы уже созданы (1024 / 1536)

1. SQL Editor → вставьте `supabase/rag_schema_migrate_to_gemini.sql`.
2. **Run** (старые чанки удалятся — потом переиндексируете).

Проверка: **Table Editor** → таблицы `kb_documents`, `kb_chunks`.

---

## Шаг 4. Документ базы знаний

Файл **`Правовой компас — контекст компании.docx`**:

- в корне проекта, **или**
- на рабочем столе, **или**
- путь в `.env`: `KB_DOCX_PATH=C:\путь\к\файлу.docx`

---

## Шаг 5. Индексация

В терминале в папке проекта:

```bash
npm install
npm run ingest:kb
```

Ожидаемый вывод в конце:

```text
Готово. Загружено фрагментов: 65
```

(число может отличаться.)

---

## Шаг 6. Проверка в Supabase

1. **Table Editor** → `kb_chunks` — должны быть строки с `content` и заполненным `embedding`.
2. **Table Editor** → `kb_documents` — одна запись `pravovoy-kompas-kb`, `chunk_count` > 0.

---

## Обновление базы знаний

После правки Word:

```bash
npm run ingest:kb
```

Скрипт перезапишет чанки документа `pravovoy-kompas-kb`.

---

## Частые ошибки

| Ошибка | Решение |
|--------|---------|
| `GEMINI_API_KEY не задана` | Добавьте ключ в `.env`, перезапустите терминал |
| `403` / `API key not valid` | Создайте новый ключ в AI Studio |
| `размерность вектора` | В `.env` поставьте `GEMINI_EMBEDDING_DIMENSION=...` из текста ошибки; выполните `rag_schema_migrate_to_gemini.sql` |
| `quota` / `429` | Лимит free tier — подождите или проверьте [квоты](https://ai.google.dev/gemini-api/docs/rate-limits) |
| Ошибка вставки в Supabase | Убедитесь, что выполнен SQL с `vector(768)` |

---

## Дальше (бот)

Сейчас реализована только **индексация**. Чтобы Александра отвечала с RAG, нужно подключить поиск `match_kb_chunks` + тот же `GEMINI_API_KEY` для эмбеддинга вопроса пользователя. Это отдельный этап в `replyWithAi`.
