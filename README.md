# TTV — tabletop campaign platform

TTV — универсальный каркас VTT/GM-платформы для кампаний с разными игровыми системами и сеттингами: от средневекового фэнтези и grimdark до sci-fi.

Первая версия специально не привязана к D&D, Warhammer или другой конкретной системе. Core работает через общие сущности, а правила, сеттинг и визуальная тема подключаются отдельными слоями.

## v0.1 — что готово

- Next.js + React + TypeScript.
- Zustand с локальным persistence.
- Campaign Hub `/campaigns`.
- Demo campaign `/campaign/demo/play`.
- Campaign settings `/campaign/demo/settings`.
- Три пресета: средневековое фэнтези, grimdark и sci-fi.
- Runtime theme tokens через CSS variables.
- Универсальные сущности `Actor`, `ItemDefinition`, `ItemInstance`, `Inventory`, `Scene`, `GameSystem`.
- Карта и токены.
- Session sidebar: группа, бой, инвентарь, NPC, заметки.
- Переключение выбранного героя между разделами.
- Инвентарь с контейнерами и drag & drop.
- Подсчёт веса инвентаря.
- Контекстный просмотр выбранного предмета.
- Мастерская ДМа поверх карты.
- Persistent библиотека предметов.
- Поиск и фильтры предметов.
- Создание и редактирование предметов.
- Дублирование и удаление предметов.
- Структурированные properties/effects.
- Быстрая выдача предмета персонажу.
- NPC workshop.
- Loot builder со случайным предметом и выдачей.
- Roll tables с историей бросков.
- Combat tracker с раундами и очередью хода.
- Заметки ДМа.
- Undo для операций инвентаря.
- Горячие клавиши: `/` поиск, `N` новый предмет, `E` редактирование, `G` выдача/мастерская, `Esc` выход из билдера.
- Permission model: Owner / GM / Assistant GM / Player / Spectator.
- Реестр Game Systems.
- Реестр Setting Packs.
- GitHub Actions: typecheck + production build.

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

Core ничего не должен знать о конкретных характеристиках системы правил. Вместо этого он знает:

```text
Actor
Item
Inventory
Scene
Token
Combat
Journal
Permission
```

`Actor` используется для персонажа игрока, NPC, существа, транспорта, спутника и призыва. Специфичные игровые характеристики лежат в `systemData`.

Предметы разделены на:

- `ItemDefinition` — шаблон предмета в библиотеке кампании;
- `ItemInstance` — конкретный экземпляр в контейнере/инвентаре.

Подробное описание архитектуры: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Структура v0.1

```text
src/
├── app/
│   ├── campaigns/
│   │   └── page.tsx
│   ├── campaign/demo/
│   │   ├── play/page.tsx
│   │   └── settings/page.tsx
│   ├── globals.css
│   ├── mvp.css
│   ├── layout.tsx
│   └── page.tsx
├── config/
│   └── campaignPresets.ts
├── core/
│   └── permissions.ts
├── data/
│   └── demo.ts
├── domain/
│   └── types.ts
├── features/
│   ├── campaign/
│   │   ├── CampaignHub.tsx
│   │   ├── CampaignSettings.tsx
│   │   └── CampaignThemeSurface.tsx
│   └── dm/
│       ├── DmDashboard.tsx
│       └── workshop/
│           ├── ItemWorkshop.tsx
│           ├── NpcWorkshop.tsx
│           ├── LootWorkshop.tsx
│           └── TablesWorkshop.tsx
├── settings/
│   └── registry.ts
├── store/
│   └── useCampaignStore.ts
└── systems/
    ├── generic-fantasy.ts
    └── registry.ts
```

## Persistence в первой версии

v0.1 — single-GM browser MVP. Состояние хранится через Zustand persist в `localStorage`:

- выбранный сеттинг/тема;
- библиотека предметов;
- инвентари;
- заметки;
- состояние боя;
- выбранные объекты интерфейса.

Это намеренное решение: сначала стабилизируется игровой flow и доменная модель, затем storage adapter заменяется на API/PostgreSQL без переписывания UI.

## Следующий этап после v0.1

- backend + PostgreSQL;
- аккаунты и авторизация;
- создание нескольких настоящих кампаний;
- campaign members и object-level permissions;
- realtime/WebSocket;
- scene persistence;
- walls/light/fog data model;
- server event log + полноценный undo;
- compendium import pipeline;
- schema-driven Actor builder;
- пользовательские Game Systems / Setting Packs.

## Контент

Демо использует только вымышленные generic данные и не содержит официальных текстов, иллюстраций или правил конкретной коммерческой настольной системы.
