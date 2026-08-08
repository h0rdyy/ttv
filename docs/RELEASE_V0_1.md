# TTV v0.1 release checklist

## Playable local GM flow

- [x] Campaign Hub and demo campaign routes.
- [x] Runtime setting/theme presets.
- [x] Map with grid/fog controls.
- [x] Persistent draggable token positions.
- [x] Party, combat, inventory, NPC and notes session panels.
- [x] Inventory containers with drag & drop and weight calculation.
- [x] Persistent item library and item builder.
- [x] Item duplication, deletion and quick distribution.
- [x] Persistent custom NPC creation/editing and scene placement.
- [x] Loot builder.
- [x] Persistent editable roll tables.
- [x] Campaign snapshot import/export.
- [x] Role/permission model.
- [x] CI typecheck + production build workflow.

## Explicitly deferred after v0.1

The following features are not fake-completed in v0.1 and require the server/multiplayer phase:

- accounts/authentication;
- real invitations and multiplayer membership;
- server-side permission enforcement;
- PostgreSQL persistence;
- WebSocket/realtime synchronization;
- multiple persistent scenes and scene asset storage;
- walls/lighting/full fog polygons;
- public compendium/package marketplace.

v0.1 is considered the first local single-GM product slice. It validates the interaction model and generic domain architecture before adding the server layer.
