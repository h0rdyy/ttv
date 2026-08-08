# TTV — tabletop campaign platform

TTV — универсальный VTT/GM-инструмент для кампаний с разными игровыми системами и сеттингами: от средневекового фэнтези и grimdark до sci-fi.

Первая версия специально не привязана к D&D, Warhammer или другой конкретной системе. Core работает через общие сущности, а правила, сеттинг и визуальная тема подключаются отдельными слоями.

## Статус

**v0.1 — verified local single-GM MVP.**

Релизная PR-проверка успешно прошла:

- `npm install`
- `npm run typecheck`
- `npm run build`

Release checklist: [`docs/RELEASE_V0_1.md`](docs/RELEASE_V0_1.md).

## Что готово в v0.1

- Next.js + React + TypeScript.
- Zustand + `localStorage` persistence.
- Campaign Hub `/campaigns`.
- Demo campaign `/campaign/demo/play`.
- Campaign settings `/campaign/demo/settings`.
- Три campaign presets: средневековое фэнтези, grimdark и sci-fi.
- Runtime theme tokens через CSS variables.
- Универсальные сущности `Actor`, `ItemDefinition`, `ItemInstance`, `Inventory`, `Scene`, `RollTable`, `GameSystem`.
- Карта с токенами.
- Перетаскивание токенов с сохранением позиции.
- Переключаемая сетка и базовый fog overlay.
- Session sidebar: группа, бой, инвентарь, NPC, заметки.
- Combat tracker с раундами и очередью хода.
- Инвентарь с контейнерами, drag & drop и подсчётом веса.
- Контекстный просмотр выбранного предмета.
- Мастерская ДМа поверх карты.
- Persistent библиотека предметов с поиском и фильтрами.
- Создание, редактирование, дублирование и удаление предметов.
- Структурированные custom properties и effects.
- Быстрая выдача предметов персонажу.
- Persistent создание/редактирование пользовательских NPC.
- Добавление созданного NPC на карту.
- Loot builder со случайным предметом и выдачей.
- Persistent editable roll tables + история бросков.
- Заметки ДМа.
- Undo для операций с инвентарём.
- Полный локальный snapshot import/export: предметы, инвентари, NPC, карта, таблицы, заметки, бой и campaign preset.
- Permission model: Owner / GM / Assistant GM / Player / Spectator.
- Реестры Game Systems и Setting Packs.
- Горячие клавиши: `/` поиск, `N` новый предмет, `E` редактирование, `G` мастерская/выдача, `Esc` выход из билдера.
- GitHub Actions: TypeScript typecheck + production Next.js build.

## Запуск

```bash
npm install
npm run dev
```

Открыть:

```text
http://localhost:3000
```

Главная автоматически переводит на `/campaigns`.

Production-проверка:

```bash
npm run typecheck
npm run build
npm run start
```

## Архитектурный принцип

```text
Platform Core
  + Game System
  + Setting Pack
  + Theme
  = Campaign
```

Core не содержит D&D/Warhammer-специфичных полей. Он знает про:

```text
Actor
Item
Inventory
Scene
Token
Combat
Journal
RollTable
Permission
```

`Actor` используется для персонажа игрока, NPC, существа, транспорта, спутника и призыва. Специфичные игровые характеристики лежат в `systemData`.

Предметы разделены на:

- `ItemDefinition` — шаблон предмета в библиотеке кампании;
- `ItemInstance` — конкретный экземпляр в контейнере/инвентаре.

Подробно: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Основная структура v0.1

```text
src/
├── app/
│   ├── campaigns/
│   ├── campaign/demo/play/
│   └── campaign/demo/settings/
├── config/
│   └── campaignPresets.ts
├── core/
│   ├── permissions.ts
│   └── snapshot.ts
├── data/
│   └── demo.ts
├── domain/
│   └── types.ts
├── features/
│   ├── campaign/
│   └── dm/
│       └── workshop/
│           ├── ItemWorkshop.tsx
│           ├── NpcWorkshop.tsx
│           ├── LootWorkshop.tsx
│           └── TablesWorkshop.tsx
├── settings/
│   └── registry.ts
├── store/
│   ├── useCampaignStore.ts
│   └── useRollTableStore.ts
├── systems/
│   └── registry.ts
└── themes/
    └── theme-registry.ts
```

## Граница первой версии

v0.1 — намеренно **локальный single-GM продуктовый срез**. Он проверяет UX игрового стола и generic-домен до подключения серверного слоя.

После v0.1:

- backend + PostgreSQL;
- аккаунты и авторизация;
- реальные приглашения и campaign members;
- серверный permission enforcement;
- realtime/WebSocket;
- несколько сохраняемых сцен;
- asset storage;
- walls, lighting и полноценный fog-of-war;
- server event log и расширенный undo;
- compendium/import pipeline;
- schema-driven Actor builder;
- пользовательские Game Systems и Setting Packs.

## Контент

Демо использует только вымышленные generic-данные и не содержит официальных текстов, иллюстраций или правил конкретной коммерческой настольной системы.
