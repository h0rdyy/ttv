# v0.2 — Data foundation

Цель этого этапа — перестать связывать UI напрямую с локальными demo-данными и подготовить проект к Supabase без потери offline/demo режима.

## Что добавлено

- `CampaignRepository` — контракт доступа к данным кампании.
- `localCampaignRepository` — текущий локальный адаптер.
- Выбор repository mode по env.
- `.env.example` под Supabase.
- Начальная PostgreSQL/Supabase schema.
- RLS foundation для campaign membership, GM roles, actors, items, journal и books.
- Модели `books` / `book_pages` уже заложены для базового Codex.

## Режимы

Без env-переменных TTV продолжает работать как локальный demo MVP.

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

При появлении Supabase-проекта будет добавлен `supabaseCampaignRepository`, который реализует тот же интерфейс, что и локальный адаптер.

## Следующий PR

1. Подключить `@supabase/supabase-js` и `@supabase/ssr`.
2. Browser/server clients.
3. Auth routes.
4. Profiles + real campaigns.
5. Campaign membership / invite flow.
6. Перевести Player View и Campaign Hub с demo IDs на реальные campaign IDs.

## Почему так

React-компоненты не должны содержать `supabase.from(...)` по всему проекту. UI зависит от repository/service layer, а storage backend можно менять независимо от игрового интерфейса.
