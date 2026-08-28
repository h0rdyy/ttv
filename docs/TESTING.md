# Testing Policy

Тесты в Meridian/TTV защищают критические свойства продукта, а не количество строк и не текущую форму UI.

## Правила

- **Критические пути тестируются до релиза фичи.** К критическим путям относятся как минимум формулы и расчёты, RLS/permissions, realtime lifecycle/cleanup, realtime delivery и другая логика, ошибка в которой может нарушить состояние кампании, безопасность или синхронизацию.
- **Unit-тесты детерминированы.** Random/time/external dependencies должны быть фиксированы или замоканы. Тест не должен зависеть от сети, реальных аккаунтов, порядка запуска или случайного результата.
- **RLS тестируется через pgTAP.** Database tests лежат в `supabase/tests`, выполняются локальным Supabase stack и изолируются транзакцией с rollback. Для CLI используется актуальная команда `supabase test db`.
- **Realtime delivery тестируется на настоящем локальном Realtime service.** CI поднимает локальный Supabase и запускает два отдельных авторизованных клиента (GM + player). Gate обязан доказать доставку campaign broadcast в обе стороны и доставку DB `state_changed` после финального сохранения состояния.
- **CI gate обязателен.** Минимальный merge gate: Vitest + realtime GM/player integration + `supabase test db` + TypeScript typecheck. Build/audit могут оставаться дополнительными проверками. PR без зелёного обязательного CI не мержится.
- **CI не изменяет dependency graph проекта.** Основные зависимости всегда устанавливаются через `npm ci`. Vitest 4.1.10 в GitHub Actions запускается через изолированный `pnpm dlx`, чтобы test runner не изменял `node_modules` или `package-lock.json` проекта.
- **UI-тесты опциональны.** Они нужны только для компонентов со сложной логикой состояний/переходов. Не писать тесты, которые лишь проверяют наличие CSS-селектора, текста кнопки или конкретную структуру JSX.
- **Coverage измеряется только там, где это помогает оценить критический модуль.** Общая цифра покрытия не является целью и не используется как замена ревью сценариев.
- **Устаревшие тесты удаляются вместе с изменением требования.** Тест, который фиксирует старый UI, старую архитектуру или конкретную реализацию вместо поведения, считается техническим долгом. Мёртвый тест хуже отсутствия теста.

## Что тестируем обязательно

### Формулы / pure logic

Примеры:

- movement distance, calibration, movement budget;
- dice formula/payload validation;
- combat/resource formulas по мере появления.

Тест должен проверять вход → результат и edge cases. Для таких модулей предпочитаем чистые функции без React/Supabase.

### RLS / permissions

Минимальный набор для каждой новой защищённой сущности:

- разрешённый пользователь видит/меняет то, что должен;
- пользователь другой кампании не получает чужие строки;
- player не получает GM-only данные;
- запрещённая запись действительно запрещена, а не просто скрыта в UI.

Используем фиксированные UUID и явный auth context. Тестовые данные не должны зависеть от production/staging.

### Realtime lifecycle

Unit-тестами обязательно проверяем lifecycle-контракты:

- все созданные каналы снимаются при cleanup/unmount;
- повторный mount не оставляет старые subscriptions/timers;
- callbacks после dispose не меняют состояние;
- временные realtime payloads валидируются перед использованием.

Supabase client/channel в этих unit-тестах мокается; реальная сеть не используется.

### Realtime delivery / convergence

Одних mock/cleanup-тестов недостаточно. `tests/integration/realtime-sync.mjs` запускается против локального Supabase Realtime и обязан проверить:

- GM и player действительно подписываются на private campaign channel;
- `token_move` от GM реально приходит player-клиенту;
- `token_move` от player реально приходит GM-клиенту;
- после сохранения позиции через `move_scene_token` второй клиент получает DB `state_changed`;
- сохранённая позиция после события читается из БД в ожидаемом виде.

Последний пункт — страховка от потери transient broadcast: live broadcast отвечает за плавность, а persisted DB event отвечает за конечную согласованность клиентов.

## Когда UI-тест всё-таки нужен

UI-тест оправдан, когда у компонента есть реальный state contract, который трудно безопасно проверить простым unit-тестом. Например:

- `Escape` закрывает верхнюю dismissible surface;
- `play / combat / prepare` меняют доступные действия;
- dirty state редактора переживает внешний refresh;
- mutually exclusive surfaces действительно закрывают друг друга.

В таком случае тестируем **событие → состояние/видимое поведение**, а не строку исходного TSX/CSS.

## Что НЕ является хорошим тестом

Не держим тесты вида:

```ts
expect(source).toContain("className=\"some-ui-class\"")
expect(css).toMatch(/bottom: 14px/)
expect(source).toContain("Персонажи")
```

Такие проверки цементируют текущую реализацию, ломаются при безвредном UI-рефакторинге и создают ложное ощущение защиты.

Исключение — редкий intentional contract test для генерируемого/статического файла, если сам текст/структура файла является публичным контрактом.

## Локальный запуск

Unit:

```bash
npm test
```

Database/RLS + Realtime integration (нужны Docker-compatible runtime и Supabase CLI):

```bash
# Один раз, если ещё нет supabase/config.toml
supabase init

supabase start

# В CI переменные берутся из `supabase status -o env`.
# Локально передайте URL / anon / service-role key тем же способом.
eval "$(supabase status -o env)"
SUPABASE_URL="$API_URL" \
SUPABASE_ANON_KEY="$ANON_KEY" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
node tests/integration/realtime-sync.mjs

supabase test db
supabase stop
```

TypeScript:

```bash
npm run typecheck
```

Полезно перед PR также запускать:

```bash
npm run build
```

## PR checklist

Перед merge фичи:

- [ ] критическая pure logic имеет детерминированные unit-тесты;
- [ ] новые/изменённые RLS правила имеют pgTAP positive + negative cases;
- [ ] realtime lifecycle изменения имеют cleanup test;
- [ ] realtime delivery/convergence проходит GM↔player integration test;
- [ ] нет тестов, сохраняющих уже отменённые требования;
- [ ] обязательный CI зелёный;
- [ ] UI-тест добавлен только если компонент действительно имеет сложный state contract.
