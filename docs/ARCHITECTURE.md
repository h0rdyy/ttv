# TTV Architecture — v0.1

TTV строится как универсальный tabletop engine, а не как сайт под одну настольную систему.

## Главный принцип

```text
Platform Core
  + Game System
  + Setting Pack
  + Theme
  = Campaign
```

Core знает о `Actor`, `ItemDefinition`, `ItemInstance`, `Inventory`, `Scene`, `Token`, `Combat` и правах доступа. Он не должен знать, что такое конкретная характеристика вроде Strength, Weapon Skill или Tech Level.

## Слои

### Core

Отвечает за общие сущности и поведение:

- Campaign
- Actor
- Scene / Token
- ItemDefinition / ItemInstance
- Inventory / Container
- Combat
- Notes / Journal
- Roles / Permissions

### Game System

Определяет игровые правила и схемы данных:

- поля Actor;
- поля предметов;
- типы урона;
- ресурсы;
- условия;
- правила боя;
- schema-driven builder.

Реестр первой версии: `src/systems/registry.ts`.

### Setting Pack

Определяет контент и ожидания мира, но не core-механику:

- архетипы;
- категории предметов;
- идеи сцен;
- стартовые наборы контента;
- lore/compendium в будущих версиях.

Реестр: `src/settings/registry.ts`.

### Theme

Определяет только presentation layer: цветовые токены, контраст, атмосферу. В v0.1 темы хранятся вместе с campaign presets в `src/config/campaignPresets.ts` и применяются через CSS variables.

## Frontend

```text
src/
├── app/
│   ├── campaigns/
│   └── campaign/demo/
│       ├── play/
│       └── settings/
├── config/
├── core/
├── data/
├── domain/
├── features/
│   ├── campaign/
│   └── dm/
│       └── workshop/
├── settings/
├── store/
└── systems/
```

Feature-first структура выбрана намеренно: игровая логика не должна превращаться в одну папку `components` с сотнями несвязанных файлов.

## State

v0.1 использует Zustand + `persist` и сохраняет состояние кампании в `localStorage`:

- выбранный пресет;
- выбранный герой и предмет;
- инвентари;
- библиотека предметов;
- заметки;
- состояние боя;
- UI session state.

Это делает первую версию запускаемой без backend. Серверный persistence должен заменить storage adapter, не меняя доменную модель UI.

## Item lifecycle

```text
System/Compendium definition
        ↓
Campaign ItemDefinition
        ↓
ItemInstance
        ↓
Inventory Container
```

`ItemDefinition` — описание шаблона. `ItemInstance` — конкретный экземпляр, который принадлежит контейнеру и имеет quantity/state.

## Actor model

Вместо `Hero` используется `Actor`:

```text
player
npc
creature
vehicle
companion
summon
```

Специфичные для системы характеристики хранятся в `systemData`.

## Permissions

Первая версия содержит модель ролей:

- owner
- gm
- assistant-gm
- player
- spectator

Permissions описаны в `src/core/permissions.ts`. UI пока работает в GM-режиме, но permission matrix уже независима от компонентов.

## DM Play Screen

`/campaign/demo/play` состоит из двух режимов работы.

### Session sidebar

Для действий «прямо сейчас»:

- группа;
- бой;
- инвентарь;
- NPC;
- заметки.

### Workshop overlay

Для создания/управления сущностями:

- предметы;
- NPC;
- лут;
- roll tables.

Это позволяет не пытаться поместить полноценный редактор в узкую правую панель карты.

## Что считается v0.1

v0.1 — локальный single-GM MVP. Он обязан демонстрировать доменную архитектуру и полный session flow, но не обязан иметь аккаунты и realtime backend.

В v0.1 входят:

- campaign hub;
- 3 setting/theme presets;
- карта и токены;
- session sidebar;
- inventory drag & drop;
- persistent item library;
- item builder;
- NPC workshop;
- loot builder;
- roll tables;
- combat tracker;
- GM notes;
- undo для операций инвентаря;
- local persistence;
- CI typecheck/build.

## Следующий серверный слой

После стабилизации UI storage adapter заменяется на API/PostgreSQL:

```text
Browser
  ↓
Query/API layer
  ↓
Domain services
  ↓
PostgreSQL
  ↓
Realtime event bus / WebSocket
```

Планируемые серверные домены:

```text
auth
campaigns
members
permissions
actors
items
inventories
scenes
combat
journals
compendium
assets
realtime
```

## Правило расширения

При добавлении новой системы нельзя добавлять в core поля вроде `strength`, `armorClass`, `weaponSkill` или `spellSlots`. Добавляется новый Game System schema, а generic UI читает schema/systemData.
