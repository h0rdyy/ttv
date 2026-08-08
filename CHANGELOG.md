# Changelog

## 0.1.0 — First playable GM MVP

### Campaign
- Campaign Hub.
- Demo campaign routes.
- Three runtime presets: medieval fantasy, grimdark, sci-fi.
- Campaign settings screen.
- Theme switching through CSS variables.

### DM play screen
- Map workspace with tokens.
- Party sidebar.
- Combat tracker with rounds and turns.
- Inventory viewer with container drag & drop.
- NPC sidebar.
- Persistent GM notes.
- Keyboard shortcuts.

### Workshop
- Persistent item library.
- Item search and filters.
- Item inspector.
- Create/edit/duplicate/delete item flow.
- Structured custom properties.
- Structured effects.
- Quick item delivery to a selected hero.
- NPC workshop.
- Loot builder and delivery.
- Roll tables and roll history.

### Architecture
- Generic Actor model.
- ItemDefinition / ItemInstance separation.
- Inventory / Container model.
- Game System registry.
- Setting Pack registry.
- Campaign preset/theme registry.
- Role/permission matrix.
- Zustand local persistence adapter.
- CI typecheck + production build workflow.

### Known scope boundaries
v0.1 is intentionally a single-GM local/browser MVP. Accounts, PostgreSQL, realtime networking, server-side scene persistence and multiplayer permission enforcement are planned for the server phase after the gameplay/domain model stabilizes.
