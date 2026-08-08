# Changelog

## 0.1.0 — First playable GM MVP

Release verification passed dependency installation, TypeScript typecheck and production Next.js build.

### Campaign
- Campaign Hub and demo campaign routes.
- Three runtime presets: medieval fantasy, grimdark and sci-fi.
- Campaign settings with local role/permission views.
- Runtime theme switching through CSS variables.
- Full local campaign snapshot import/export.

### DM play screen
- Map workspace with persistent draggable tokens.
- Grid and basic fog controls.
- Party sidebar.
- Combat tracker with persisted rounds and turns.
- Inventory viewer with container drag & drop and weight calculation.
- NPC sidebar including custom campaign NPCs.
- Persistent GM notes.
- Keyboard shortcuts.

### Workshop
- Persistent item library.
- Item search and filters.
- Item inspector.
- Create/edit/duplicate/delete item flow.
- Structured custom properties and effects.
- Quick item delivery to a selected hero.
- Persistent custom NPC creation/editing and scene placement.
- Loot builder and delivery.
- Persistent editable roll tables and roll history.

### Architecture
- Generic Actor model.
- ItemDefinition / ItemInstance separation.
- Inventory / Container model.
- Scene / Token model.
- RollTable model.
- Game System registry.
- Setting Pack registry.
- Campaign preset/theme registry.
- Role/permission matrix.
- Zustand local persistence adapters.
- CI typecheck + production build workflow.

### Known scope boundaries
v0.1 is intentionally a single-GM local/browser MVP. Accounts, PostgreSQL, realtime networking, multiple server-persisted scenes, asset storage and multiplayer permission enforcement are planned for the server phase after the gameplay/domain model stabilizes.
