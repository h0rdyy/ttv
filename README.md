# TTV — tabletop campaign platform

Универсальный каркас VTT/GM-платформы для кампаний с разными игровыми системами и сеттингами: от средневекового фэнтези до grimdark/sci-fi.

## Что уже реализовано

- Next.js + React + TypeScript.
- Feature-first структура.
- Универсальные сущности `Actor`, `ItemDefinition`, `ItemInstance`, `Inventory`, `Scene`, `GameSystem`.
- Рабочая DM-страница с картой и токенами.
- Правая session-панель: группа, бой, инвентарь, NPC, заметки.
- Переключение выбранного героя между разделами.
- Инвентарь с контейнерами и drag & drop между ними.
- Контекстный просмотр выбранного предмета.
- Мастерская ДМа поверх карты.
- Библиотека предметов с поиском и фильтрами.
- Просмотр предмета и упрощённый item builder.
- Быстрая выдача предмета персонажу.
- Undo для операций с инвентарём.
- Горячие клавиши: `/` поиск, `N` новый предмет, `E` редактирование, `Esc` выход из билдера.
- Демо-данные кампании.
- Основа schema-driven Game System для разных систем правил.

## Запуск

```bash
npm install
npm run dev
```

После запуска открыть `http://localhost:3000`.

Для production-проверки:

```bash
npm run build
npm run start
```

## Архитектурный принцип

Core приложения не должен зависеть от D&D/Warhammer/другой конкретной системы.

```text
Platform Core
  + Game System
  + Setting Pack
  + Theme
  = Campaign
```

`Actor` используется и для героя, и для NPC, и для существа, и для транспорта. Игровые характеристики живут в `systemData`, а конкретная игровая система определяет schema и правила отображения.

Предметы разделены на:

- `ItemDefinition` — шаблон/описание предмета.
- `ItemInstance` — конкретный экземпляр в инвентаре.

Это позволяет независимо изменять предметы кампании и состояние конкретных экземпляров.

## Текущая структура

```text
src/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── data/
│   └── demo.ts
├── domain/
│   └── types.ts
├── features/
│   └── dm/
│       └── DmDashboard.tsx
├── store/
│   └── useCampaignStore.ts
└── systems/
    └── generic-fantasy.ts
```

## Следующие архитектурные модули

```text
features/
├── map/
├── actors/
├── items/
├── inventory/
├── combat/
├── workshop/
├── journal/
├── scenes/
└── compendium/

systems/
├── core/
├── generic/
├── generic-fantasy/
└── warhammer-like/

themes/
├── dark-fantasy/
├── grimdark/
└── medieval/
```

## Ближайшие задачи

1. Разнести `DmDashboard` на feature-компоненты.
2. Подключить persistence/API вместо demo data.
3. Добавить PostgreSQL и серверную модель кампании.
4. Реализовать permissions: Owner / GM / Assistant GM / Player / Spectator.
5. Добавить realtime события для токенов, HP, инвентаря и боя.
6. Реализовать Theme Provider и Setting Pack API.
7. Сделать полноценный schema-driven builder для предметов и Actor.
8. Добавить Compendium → Campaign Library → Inventory pipeline.

## Важно

Демо использует вымышленные generic-fantasy данные и не содержит официального защищённого контента конкретной настольной системы.
