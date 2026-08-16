---
name: ttv-heritage
version: 0.1
status: draft
purpose: "Design system and interaction specification for the TTV tabletop UI"

principles:
  map_first: true
  progressive_disclosure: true
  contextual_actions: true
  mode_driven_ui: true
  keyboard_acceleration: true
  no_overlapping_persistent_ui: true
  responsive_by_layout: true

modes:
  - play
  - combat
  - prepare

colors:
  canvas: "#090806"
  surface_1: "#0D0B08"
  surface_2: "#15110C"
  surface_3: "#20170F"
  border_subtle: "#2F261A"
  border: "#493822"
  border_strong: "#6B4D2A"
  text_primary: "#E8D1A7"
  text_secondary: "#A99576"
  text_muted: "#746855"
  accent: "#C9924F"
  accent_hover: "#E0B56F"
  danger: "#A84F3A"
  success: "#668653"
  warning: "#B8863E"
  backdrop: "rgba(0, 0, 0, 0.42)"

typography:
  display:
    family: "Georgia, 'Times New Roman', serif"
    weight: 700
  ui:
    family: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    weight: 500
  sizes:
    xs: 8
    sm: 10
    md: 12
    lg: 14
    xl: 18
    title: 22

spacing:
  1: 4
  2: 8
  3: 12
  4: 16
  5: 24
  6: 32

radii:
  control: 6
  panel: 10
  floating: 14
  round: 999

sizes:
  topbar_height: 44
  action_dock_height: 48
  compact_control_height: 36
  comfortable_control_height: 42
  drawer_width: 300
  inspector_width: 280
  player_hud_max_width: 340
  compact_breakpoint: 1100
  mobile_breakpoint: 760

layers:
  map: 0
  map_overlay: 5
  chrome: 10
  drawer: 20
  inspector: 22
  popover: 30
  context_menu: 32
  workspace: 40
  command_palette: 45
  toast: 50

motion:
  fast_ms: 120
  normal_ms: 180
  slow_ms: 240
  easing: "ease-out"

safe_zones:
  top: "campaign, scene, presence, session menu"
  bottom_left: "mode and frequent contextual actions"
  bottom_center: "camera controls"
  bottom_right: "player character HUD"
  left_context: "task drawer when explicitly opened"
  right_context: "selection inspector when a context target exists"
---

# TTV Design System

`DESIGN.md` is the source of truth for the tabletop interface. New UI should follow this document before adding floating controls, layout exceptions, or one-off visual rules.

The goal is not to make the interface empty. The goal is to keep the **map as the primary working surface** while making important actions obvious without requiring users to memorize hotkeys.

## 1. Core rules

### Map first

The map is the default state of the tabletop. UI may reduce the map viewport when a task requires persistent information, but persistent chrome must never cover another persistent UI element.

Do not solve layout conflicts with higher `z-index` values. Persistent UI receives real layout space or an exclusive safe zone.

### Progressive disclosure

Show only the information needed for the current task.

- No scene editing controls during ordinary play.
- No initiative when combat is inactive.
- No full character sheet when a compact HUD is enough.
- No permanent dice panel after the roll is finished.

### Context before navigation

When an action belongs to an object on the map, expose it near that object or through a context menu.

Examples:

- Token -> sheet, HP, visibility, remove from scene.
- Empty map -> map/scene actions.
- Selected area -> dimensions, occupants, fog/terrain actions in Prepare mode.

### Modes represent scenarios

The tabletop has three modes:

- `play` — ordinary session and exploration.
- `combat` — active initiative/combat runtime.
- `prepare` — GM-only scene and content preparation.

Modes promote the actions relevant to the current scenario. They do not create duplicate data models.

### Hotkeys accelerate; they do not replace discoverability

Primary actions must remain discoverable without keyboard knowledge.

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + K` | Command palette |
| `Esc` | Close highest dismissible surface |
| `H` | Hide/show tabletop chrome |
| `Space + drag` | Pan map |
| Mouse wheel | Zoom map |

## 2. Canonical shell

```text
TabletopShell
├── TopBar
├── MapViewport
│   ├── MapWorld
│   ├── Tokens
│   └── MapContextLayer
├── TaskDrawer
├── SelectionInspector
├── ActionDock
├── CameraControls
├── PlayerCharacterHud
├── Workspace
├── CommandPalette
└── ToastLayer
```

Only a higher semantic layer may cover a lower one.

## 3. Safe zones

Persistent UI must occupy a known zone. Two persistent components must never share a zone.

```text
┌──────────────────────────────────────────────────────────┐
│ TOP: campaign · scene                         online · ☰ │
├──────────────────────────────────────────────────────────┤
│                                                          │
│                         MAP                              │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ MODE/ACTIONS          CAMERA              PLAYER HUD     │
└──────────────────────────────────────────────────────────┘
```

### Top

Reserved for:

- campaign name;
- active scene;
- presence/connectivity;
- global/session menu.

Do not place zoom, dice, character actions, workshop, measurement, or combat tools here.

### Bottom-left

Reserved for:

- current mode;
- 2-3 most likely actions;
- entry point to all actions/search.

### Bottom-center

Reserved for camera controls:

```text
[-] [100% / Fit] [+]
```

### Bottom-right

Reserved for the player's compact character HUD.

### Left contextual area

Used by one task drawer at a time: Characters, Combat, Library, Notes, Prepare tools.

Opening a drawer reduces map width. It never overlays the map.

### Right contextual area

Used by the selection inspector only when a meaningful context target exists.

No selection -> no inspector -> the map receives the space back.

## 4. GM layouts

### Play mode

Default state is calm but not empty.

```text
┌──────────────────────────────────────────────────────────────────┐
│ Campaign                 Scene                         ● Online ☰ │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                              MAP                                 │
│                                                                  │
│                                                                  │
│ [Play] [Characters] [Dice] [Prepare]     [-] [100%] [+]         │
└──────────────────────────────────────────────────────────────────┘
```

Visible priorities:

1. Characters
2. Dice
3. Prepare
4. All actions/search

### Characters drawer

```text
┌──────────────────┬───────────────────────────────────────────────┐
│ CHARACTERS       │                                               │
│ Search           │                                               │
│ Nastya           │                    MAP                        │
│ Danila           │                                               │
│ Ilyas            │                                               │
│ NPCs             │                                               │
│ + Create         │                                               │
└──────────────────┴───────────────────────────────────────────────┘
```

Drawer width target: `300px` desktop.

### Selection inspector

```text
┌───────────────┬────────────────────────────┬────────────────────┐
│ CHARACTERS    │                            │ NASTYA             │
│               │                            │ HP 23 / 30         │
│ Nastya        │            MAP             │ Defense 16         │
│ Danila        │                            │ Speed 30 ft        │
│ Ilyas         │                            │ Effects: 2         │
│               │                            │ [Open sheet]       │
└───────────────┴────────────────────────────┴────────────────────┘
```

Inspector rules:

- appears only from current context;
- closes when context is cleared;
- contains compact, reversible actions;
- never contains the full character sheet.

### Combat mode

Combat mode activates automatically from campaign runtime.

Promote:

- round;
- current actor/turn;
- combat tracker;
- player movement budget;
- combat-relevant quick actions.

```text
┌──────────────────────────────────────────────────────────────────┐
│ Campaign        Scene        ⚔ Round 4                ● Online ☰ │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                              MAP                                 │
│                                                                  │
│ [⚔ Combat] [Turn: Nastya] [Characters] [Dice]   [-] [100%] [+] │
└──────────────────────────────────────────────────────────────────┘
```

Opening Combat creates a task drawer, not a floating overlay.

### Prepare mode

Prepare mode is GM-only and may expose more controls because the user explicitly entered an editing workflow.

```text
┌──────────────────────────────────────────────────────────────────┐
│ Prepare · Scene name                                      Done  │
├──────────────────┬───────────────────────────────────────────────┤
│ SCENE            │                                               │
│ Map              │                                               │
│ Grid             │                                               │
│ Fog              │                    MAP                        │
│ Tokens           │                                               │
│ Lighting         │                                               │
│ Measurement      │                                               │
└──────────────────┴───────────────────────────────────────────────┘
```

Measurement/calibration belongs under `Scene -> Measurement`. It is not a permanent Play-mode control.

## 5. Player layout

Player UI is intentionally simpler.

```text
┌──────────────────────────────────────────────────────────────────┐
│ Campaign                    Scene                       ● Online │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                              MAP                                 │
│                                                                  │
│                                                ┌──────────────┐  │
│                                                │ Avatar Name  │  │
│                                                │ ♥ 23 / 30    │  │
│                                                │ Stat 16      │  │
│                                                │ [Sheet] [🎲] │  │
│                                                └──────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

Always-visible Player HUD information should be limited to high-session-value data:

- actor identity;
- HP;
- optional promoted stat supplied by the game system/schema;
- active effects indicator;
- open sheet;
- dice.

Movement is promoted when relevant, normally during the player's combat turn.

The platform shell must not hardcode D&D-specific stats such as AC.

## 6. Context menus

Context menus expose object-specific actions without filling the screen with buttons.

### GM token context

Recommended first level:

```text
Actor name
HP 7 / 12
────────────
Open sheet
Adjust HP
Hide / Show
Remove from scene
More…
```

Destructive operations such as deleting the Actor from the campaign belong under `More…` and require confirmation.

### Player token context

Only actions permitted by ownership and game rules are shown. Do not show disabled GM actions merely to advertise their existence.

### Empty-map context

Useful GM actions may include:

- add token;
- add note;
- measure;
- enter Prepare mode.

## 7. Surface selection

Use the smallest appropriate surface.

### Popover

Short temporary choice or parameter adjustment.

Examples: dice palette, compact scene selector, token quick menu.

### Drawer

Task requiring scanning or repeated interactions while watching the map.

Examples: Characters, Combat, Notes, Library, Prepare Scene tools.

### Inspector

Compact details/actions for the current selected object.

### Workspace

Focused editor for dense creation/editing tasks.

Examples:

- full character sheet;
- item builder;
- future book/journal authoring;
- complex scene editor.

When a Workspace is open, ordinary tabletop chrome is hidden. The workspace owns navigation back to the table.

## 8. Canonical UI components

```text
Button
IconButton
SegmentedControl
TopBar
ModeControl
ActionDock
CameraControls
Drawer
Inspector
Popover
ContextMenu
Workspace
CharacterHud
CombatTracker
CommandPalette
Toast
```

Do not create a new visual primitive if an existing component expresses the same interaction.

### Button rules

- Text buttons for actions whose meaning is not obvious from an icon.
- Icon-only controls require `aria-label` and tooltip.
- Normally one primary action per panel/workspace.
- Danger styling appears only at the final destructive step.

### Icon rules

Icons support meaning; they do not replace labels for primary navigation on desktop.

At compact widths, secondary labels may collapse while tooltips remain available.

## 9. Layering policy

Do not use arbitrary z-index escalation.

Semantic layers are defined in the frontmatter:

```text
map            0
map overlay    5
chrome        10
drawer        20
inspector     22
popover       30
context menu  32
workspace     40
command       45
toast         50
```

If two components on the same layer overlap, that is a layout/state bug. Do not fix it with `z-index: 9999`.

## 10. Collision policy

Transient surfaces are exclusive by group.

Examples:

```text
Dice -> UI Preferences       => close Dice
UI Preferences -> Popover    => close UI Preferences
Workspace -> normal chrome   => Workspace wins
Command Palette -> Popover   => Command Palette wins
```

Drawer + Inspector may coexist because they own different layout zones.

## 11. Responsive behavior

### Desktop > 1100px

- labels visible;
- drawer `300px`;
- inspector about `280px`;
- camera controls bottom-center;
- persistent chrome never overlaps.

### Compact 760-1100px

- secondary labels may collapse;
- drawer may reduce to about `260px`;
- avoid Drawer + Inspector simultaneously if map space becomes unusable;
- lower-priority surface yields to higher-priority task context.

### Mobile < 760px

Do not shrink desktop layout mechanically.

- map remains primary;
- only one bottom task surface at a time;
- drawers become bottom/full-height sheets;
- command palette remains searchable;
- touch targets stay at least `42px` where practical.

## 12. Accessibility

- Minimum target: `36px` desktop, `42px` preferred touch.
- Every icon-only control has `aria-label`.
- Keyboard focus is visible.
- `Esc` closes the highest dismissible surface deterministically.
- Hotkeys never fire while typing in an editor/input.
- Critical meaning cannot depend on color alone.

## 13. Universal tabletop requirement

Core UI belongs to the platform, not to one game system.

Avoid mandatory platform concepts such as:

```text
AC
Spell Slots
5 ft
D20 Attack
```

Prefer system-provided metadata:

```text
promoted defensive stat from Game System
movement unit from Scene/Game System
resource chips from Character Schema
roll actions from Game System
```

D&D-like behavior belongs in a game-system/campaign preset rather than the platform shell.

## 14. Target UI state model

The final shell should use explicit React state instead of DOM-query adapters.

```ts
type TabletopUiState = {
  mode: 'play' | 'combat' | 'prepare';
  drawer: 'characters' | 'combat' | 'library' | 'notes' | 'scene' | null;
  contextTarget: { type: 'actor' | 'token' | 'map' | 'area'; id?: string } | null;
  inspector: 'actor' | 'token' | null;
  popover: 'dice' | 'ui-preferences' | 'scene-selector' | null;
  workspace: 'character' | 'item' | 'book' | null;
  commandPaletteOpen: boolean;
  chromeHidden: boolean;
};
```

UI transitions go through one controller so collision behavior is deterministic.

## 15. Implementation plan

The current contextual UI experiments are prototypes, not the final architecture.

Recommended migration:

1. Introduce canonical CSS design tokens from this file.
2. Introduce `TabletopUiController` with explicit state.
3. Build final `TopBar`, `ActionDock`, and `CameraControls`.
4. Implement one canonical `Drawer`.
5. Move Characters into Drawer.
6. Move Combat into Drawer.
7. Move Scene/Measurement into Prepare Drawer.
8. Add token/map context menus.
9. Introduce canonical `Inspector`.
10. Move character/item editors to `Workspace` behavior.
11. Replace DOM `querySelector().click()` adapters with direct state/callbacks.
12. Remove legacy floating triggers and obsolete CSS layers.
13. Add interaction-level browser tests for collision and responsive behavior.

## 16. Definition of done

A tabletop UI change is not complete unless all relevant statements are true:

- [ ] No persistent UI overlaps another persistent UI at supported viewport sizes.
- [ ] The primary action is discoverable without knowing a hotkey.
- [ ] The map receives space back when contextual panels close.
- [ ] Dense editors activate Workspace/focus behavior.
- [ ] Rare actions are not permanently visible without a strong reason.
- [ ] The same action is not duplicated in multiple permanent locations.
- [ ] `Esc` behavior is deterministic.
- [ ] The UI remains usable around 1300px desktop width.
- [ ] Compact/mobile behavior is intentionally defined.
- [ ] Core components do not hardcode one tabletop game system.
- [ ] New z-index values use the semantic layer scale.
- [ ] New controls reuse canonical tokens/components.

## 17. Design review checklist

Before implementing a major tabletop feature, answer:

1. In which mode is this feature relevant?
2. Is it persistent, contextual, drawer-level, popover-level, inspector-level, or workspace-level?
3. What existing UI disappears or yields space when it opens?
4. Can the user discover it without documentation or a memorized shortcut?

If these questions do not have clear answers, the feature is not ready to enter the tabletop shell.
