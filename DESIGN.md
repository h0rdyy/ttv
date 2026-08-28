---
name: meridian
version: 0.2
status: draft
purpose: "Brand, design-system and interaction specification for the Meridian tabletop platform"

tagline: "Where worlds align."

brand:
  name: "Meridian"
  concept: "A common axis connecting worlds, stories, systems and players."
  archetypes:
    - explorer
    - creator
  personality:
    - calm
    - precise
    - atmospheric
    - intelligent
    - universal
  visual_language:
    - cartography
    - coordinates
    - meridian_lines
    - horizons
    - intersections
    - portals
    - subtle_constellations
  avoid:
    - d20_as_primary_brand_symbol
    - dragons_as_brand_identity
    - runes_as_default_brand_language
    - permanent_fantasy_styling
    - excessive_neon
    - gamer_cliches
    - genre_specific_core_ui

principles:
  map_first: true
  progressive_disclosure: true
  contextual_actions: true
  mode_driven_ui: true
  keyboard_acceleration: true
  discoverable_without_hotkeys: true
  no_overlapping_persistent_ui: true
  responsive_by_layout: true
  one_ui_state_controller: true
  core_ux_is_theme_independent: true

modes:
  - play
  - combat
  - prepare

colors:
  canvas: "#090B0E"
  surface_1: "#11151A"
  surface_2: "#171C22"
  surface_3: "#20262D"
  border_subtle: "#29313A"
  border: "#3A4652"
  border_strong: "#5E6B77"
  text_primary: "#E8E4DA"
  text_secondary: "#AAB0B7"
  text_muted: "#747D86"
  accent: "#C5A46D"
  accent_hover: "#D8B982"
  accent_secondary: "#6E8DA4"
  danger: "#A9504A"
  success: "#668653"
  warning: "#B8863E"
  backdrop: "rgba(0, 0, 0, 0.42)"

typography:
  brand:
    family: "Georgia, 'Times New Roman', serif"
    weight: 700
    tracking: "0.12em"
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
  language:
    - navigation
    - alignment
    - lines_connecting_points
    - subtle_coordinate_shift
  avoid:
    - gratuitous_glitch
    - excessive_particles
    - arcade_bounce

safe_zones:
  top: "campaign, scene, presence, session menu"
  bottom_left: "mode and frequent contextual actions"
  bottom_center: "camera controls"
  bottom_right: "player character HUD"
  left_context: "task drawer when explicitly opened"
  right_context: "selection inspector when a context target exists"

theming:
  architecture:
    core_layout: immutable
    interaction_patterns: immutable
    accessibility: immutable
    keyboard_model: immutable
    semantic_tokens: themeable
    decorative_assets: themeable
    motion_flavor: themeable_within_limits
  theme_controls:
    colors: true
    typography_display: true
    borders: true
    textures: true
    icons: true
    token_frames: true
    dice_skin: true
    decorative_motion: true
  theme_must_not_change:
    - navigation_logic
    - drawer_behavior
    - inspector_behavior
    - context_menu_behavior
    - keyboard_shortcuts
    - workspace_hierarchy
    - safe_zones
    - accessibility
    - touch_target_rules
    - semantic_layer_order
---

# Meridian Design System

> **Agent contract:** this document is the source of truth for all new tabletop UI work. Before creating or changing UI, read this file first. Do not invent a new layout pattern, permanent floating control, arbitrary z-index, genre-specific core behavior, or duplicate navigation path when an existing rule here applies.

Meridian is a universal tabletop platform for different game systems, genres and campaign settings. The platform itself must remain recognizable and usable whether a campaign is dark fantasy, cyberpunk, cosmic horror, western, sci-fi or something custom.

The core idea of the brand is simple:

> **MERIDIAN — Where worlds align.**

A meridian is a line that connects distant points within one coordinate system. Meridian plays the same role for campaigns: it connects worlds, players, rules, scenes and stories without forcing them into one genre.

---

## 1. Agent rules: immutable vs themeable

### Immutable core

An agent MUST preserve these across every campaign theme:

- information architecture;
- navigation logic;
- placement and meaning of safe zones;
- Drawer / Inspector / Popover / Workspace behavior;
- context-menu behavior;
- keyboard shortcuts;
- focus and accessibility behavior;
- semantic layer order;
- responsive intent;
- game-system neutrality of platform components.

A campaign theme may make a Drawer look like parchment, glass, brushed metal or paper. It may **not** move the Drawer somewhere else or change how it opens.

### Themeable layer

A setting/theme MAY change:

- semantic color values;
- display typography;
- borders and corner treatment;
- surface textures;
- decorative icons;
- token frames;
- dice appearance;
- loading art;
- subtle animation flavor;
- ambient effects.

### Forbidden agent shortcuts

Do NOT:

- solve collisions with `z-index: 9999`;
- add an independent `position: fixed` button without assigning it a safe zone;
- put a permanent tool on screen because it is difficult to expose contextually;
- hardcode D&D-specific concepts into platform chrome;
- make hotkeys the only discoverable access path;
- duplicate the same primary action in several persistent locations;
- create a new primitive when a canonical component already expresses the interaction;
- change core layout just to make one campaign theme look more dramatic.

---

# 2. Brand identity

## 2.1 Brand meaning

Meridian should feel like a **platform between worlds**, not like a fantasy product.

The visual identity is based on:

- cartography;
- coordinates;
- map lines;
- horizons;
- intersection points;
- orbital/portal geometry;
- subtle constellation-like structures.

The brand should avoid using a d20, dragon, rune, sword or spellbook as its primary symbol. Those belong to specific games/settings, not to Meridian itself.

## 2.2 Brand mark direction

Preferred logo geometry:

```text
        │
     ╭──┼──╮
     │  ◇  │
     ╰──┼──╯
        │
```

Interpretation:

- vertical line = meridian / axis;
- center point = current world / campaign / table;
- arcs = horizon / globe / portal;
- intersections = people, systems and stories meeting in one place.

The actual logo may evolve, but it should retain this geometric language rather than becoming genre art.

## 2.3 Wordmark

Preferred public wordmark:

```text
M E R I D I A N
```

Uppercase with restrained tracking. The wordmark should feel editorial/cartographic rather than esports-like.

## 2.4 Core palette

Meridian Core is deliberately neutral:

```text
Meridian Black       #090B0E
Deep Graphite        #11151A
Meridian Ivory       #E8E4DA
Cartographic Grey    #AAB0B7
Meridian Gold        #C5A46D
Meridian Blue        #6E8DA4
Signal Red           #A9504A
```

Gold is muted and cartographic, not medieval treasure gold. Blue prevents the product from drifting into permanent dark-fantasy brown.

## 2.5 Typography

Brand/display typography may use an elegant serif. Functional UI remains a highly readable sans-serif.

Conceptually:

```text
MERIDIAN              <- brand / display
Campaign / Character  <- functional UI
```

Do not use ornate fantasy fonts for normal controls.

## 2.6 Motion language

Core Meridian motion should communicate **navigation and alignment**.

Good:

- a line connecting two points;
- a subtle coordinate grid shift;
- surfaces aligning into position;
- a marker appearing at an intersection;
- restrained fade/slide transitions.

Avoid as global brand behavior:

- constant glitch;
- particle explosions;
- elastic arcade motion;
- excessive holographic effects.

A cyberpunk campaign theme may add restrained glitch flavor inside the theme layer, but Meridian Core does not become cyberpunk.

## 2.7 Tone of voice

Voice is:

- calm;
- concise;
- human;
- confident;
- non-theatrical;
- free of unnecessary technical jargon.

Good:

```text
Создать сцену
Не удалось загрузить карту.
Этим персонажем управляет другой игрок.
```

Avoid:

```text
Создать новую сущность сцены
Background asset upload failed
Приготовьтесь, герои! Великое приключение ждёт!
```

The campaign may be theatrical. Meridian itself should not force a tone onto the campaign.

---

# 3. Product and theme architecture

Meridian separates three concerns:

```text
Meridian Platform Core
        ↓
Game System
        ↓
Setting / Theme
```

Example:

```text
Meridian Core
+ universal/d20-like system
+ dark fantasy theme

Meridian Core
+ another game system
+ cyberpunk theme
```

The same user should immediately understand how to navigate both.

A campaign may conceptually store:

```ts
type CampaignPresentation = {
  systemId: string;
  settingPackId?: string;
  themeId: string;
};
```

A Setting Pack may recommend a theme, but system mechanics and visual theme are separate concerns.

### Theme token rule

Components consume semantic tokens:

```css
background: var(--surface-primary);
color: var(--text-primary);
border-color: var(--border-primary);
```

Do not embed genre colors directly into reusable components.

Possible themes:

```text
Meridian Core / Neutral
Dark Fantasy
High Fantasy
Cosmic Horror
Cyberpunk
Sci-Fi
Western
Post-Apocalypse
Minimal
Custom
```

---

# 4. Core interaction principles

## Map first

The map is the default working surface. UI may reduce map viewport size when a task requires persistent information, but persistent chrome must never cover another persistent UI element.

Do not solve layout conflicts with higher `z-index` values. Persistent UI receives real layout space or an exclusive safe zone.

## Progressive disclosure

Show only information needed for the current task.

- No scene editing controls during ordinary play.
- No initiative when combat is inactive.
- No full character sheet when a compact HUD is enough.
- No permanent dice panel after the roll is finished.

## Context before navigation

When an action belongs to an object on the map, expose it near that object or through a context menu.

Examples:

- Token -> sheet, health/resources, visibility, remove from scene.
- Empty map -> map/scene actions.
- Selected area -> dimensions, occupants, fog/terrain actions in Prepare mode.

## Modes represent scenarios

```ts
type TableMode = 'play' | 'combat' | 'prepare';
```

- `play` — ordinary session and exploration;
- `combat` — active initiative/combat runtime;
- `prepare` — GM-only scene/content preparation.

Modes promote relevant actions. They do not create duplicate data models.

## Hotkeys accelerate; they do not replace discoverability

Primary actions remain visible/discoverable without keyboard knowledge.

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + K` | Command palette |
| `Esc` | Close highest dismissible surface |
| `H` | Hide/show tabletop chrome |
| `Space + drag` | Pan map |
| Mouse wheel | Zoom map |

---

# 5. Canonical shell

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

---

# 6. Safe zones

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

Do not place zoom, dice, character actions, workshop, measurement or combat tools here.

### Bottom-left

Reserved for current mode, 2–3 frequent contextual actions and access to all actions/search.

### Bottom-center

Reserved for camera controls:

```text
[-] [100% / Fit] [+]
```

### Bottom-right

Reserved for the player's compact character HUD.

### Left contextual area

Used by one Task Drawer at a time: Characters, Combat, Library, Notes, Prepare tools.

Opening a Drawer reduces map width. It never overlays the map.

### Right contextual area

Used by Selection Inspector only when a meaningful context target exists.

No selection -> no inspector -> map receives the space back.

---

# 7. GM layouts

## Play mode

Default state should be calm but not empty.

```text
┌──────────────────────────────────────────────────────────────────┐
│ Campaign                 Scene                         ● Online ☰ │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                              MAP                                 │
│                                                                  │
│ [Play] [Characters] [Dice] [Prepare]     [-] [100%] [+]         │
└──────────────────────────────────────────────────────────────────┘
```

Visible priorities:

1. Characters
2. Dice
3. Prepare
4. All actions/search

## Characters Drawer

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

Target desktop width: `300px`.

## Selection Inspector

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

Rules:

- appears only from current context;
- closes when context is cleared;
- contains compact, reversible actions;
- never contains the full character sheet.

## Combat mode

Combat mode activates automatically from campaign runtime.

Promote:

- round;
- current actor/turn;
- combat tracker;
- movement/resource budget when relevant;
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

Opening Combat creates a Task Drawer, not a floating overlay.

## Prepare mode

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

---

# 8. Player layout

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

Always-visible HUD information should be limited to high-session-value data:

- actor identity;
- primary health/resource supplied by the game system;
- optional promoted stat supplied by schema/system;
- active effects indicator;
- open sheet;
- dice.

Movement is promoted only when relevant, normally during the player's combat turn.

Platform shell must not hardcode D&D-specific stats such as AC.

---

# 9. Context menus

Context menus expose object-specific actions without filling the screen with buttons.

## GM token context

Recommended first level:

```text
Actor name
HP / Resource
────────────
Open sheet
Adjust resource
Hide / Show
Remove from scene
More…
```

Destructive operations such as deleting the Actor from the campaign belong under `More…` and require confirmation.

## Player token context

Only actions permitted by ownership and game rules are shown. Do not show disabled GM actions merely to advertise their existence.

## Empty-map context

Useful GM actions may include:

- add token;
- add note;
- measure;
- enter Prepare mode.

---

# 10. Surface selection

Use the smallest appropriate surface.

### Popover

Short temporary choice or parameter adjustment.

Examples: dice palette, compact scene selector, token quick menu.

### Drawer

Task requiring scanning or repeated interactions while watching the map.

Examples: Characters, Combat, Notes, Library, Prepare Scene tools.

### Inspector

Compact details/actions for current selected object.

### Workspace

Focused editor for dense creation/editing tasks.

Examples:

- full character sheet;
- item builder;
- book/journal authoring;
- complex scene editor.

When Workspace is open, ordinary tabletop chrome is hidden. Workspace owns navigation back to the table.

---

# 11. Canonical components

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
- Danger styling appears only at final destructive step.

### Icon rules

Icons support meaning; they do not replace labels for primary navigation on desktop.

At compact widths secondary labels may collapse while tooltips remain available.

---

# 12. Layering and collision policy

Never use arbitrary z-index escalation.

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

If two components on the same semantic layer overlap, that is a layout/state bug.

Transient surfaces are exclusive by group.

Examples:

```text
Dice -> UI Preferences       => close Dice
UI Preferences -> Popover    => close UI Preferences
Workspace -> normal chrome   => Workspace wins
Command Palette -> Popover   => Command Palette wins
```

Drawer + Inspector may coexist because they own different layout zones.

---

# 13. Responsive behavior

## Desktop > 1100px

- labels visible;
- drawer `300px`;
- inspector about `280px`;
- camera controls bottom-center;
- persistent chrome never overlaps.

## Compact 760–1100px

- secondary labels may collapse;
- drawer may reduce to about `260px`;
- avoid Drawer + Inspector simultaneously if map becomes unusable;
- lower-priority surface yields to higher-priority task context.

## Mobile < 760px

Do not shrink desktop layout mechanically.

- map remains primary;
- only one bottom task surface at a time;
- drawers become bottom/full-height sheets;
- command palette remains searchable;
- touch targets stay at least `42px` where practical.

The UI must remain intentionally usable around **1300px desktop width** without clipped or inaccessible controls.

---

# 14. Accessibility

- Minimum target: `36px` desktop, `42px` preferred touch.
- Every icon-only control has `aria-label`.
- Keyboard focus is visible.
- `Esc` closes highest dismissible surface deterministically.
- Hotkeys never fire while typing in editor/input.
- Critical meaning cannot depend on color alone.
- Campaign themes must preserve contrast and focus visibility.

---

# 15. Universal tabletop requirement

Core UI belongs to Meridian, not to one game system.

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

Genre/system-specific behavior belongs in game-system or campaign presets rather than the platform shell.

---

# 16. Target UI state model

Final shell should use explicit React state instead of DOM-query adapters.

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

---

# 17. Implementation plan

Current contextual UI experiments are prototypes, not final architecture.

Recommended migration:

1. Introduce canonical Meridian CSS semantic tokens from this file.
2. Introduce `TabletopUiController` with explicit state.
3. Build final `TopBar`, `ActionDock`, and `CameraControls`.
4. Implement one canonical `Drawer`.
5. Move Characters into Drawer.
6. Move Combat into Drawer.
7. Move Scene/Measurement into Prepare Drawer.
8. Add token/map context menus.
9. Introduce canonical `Inspector`.
10. Move character/item/book editors to `Workspace` behavior.
11. Replace DOM `querySelector().click()` adapters with direct state/callbacks.
12. Remove legacy floating triggers and obsolete CSS layers.
13. Add interaction-level browser tests for collision and responsive behavior.
14. Add theme provider consuming semantic Meridian tokens.
15. Add campaign theme selection only after core UX is stable.

---

# 18. Definition of done

A tabletop UI change is not complete unless all relevant statements are true:

- [ ] No persistent UI overlaps another persistent UI at supported viewport sizes.
- [ ] Primary action is discoverable without knowing a hotkey.
- [ ] Map receives space back when contextual panels close.
- [ ] Dense editors activate Workspace/focus behavior.
- [ ] Rare actions are not permanently visible without a strong reason.
- [ ] Same action is not duplicated in multiple permanent locations.
- [ ] `Esc` behavior is deterministic.
- [ ] UI remains usable around 1300px desktop width.
- [ ] Compact/mobile behavior is intentionally defined.
- [ ] Core components do not hardcode one tabletop game system or setting.
- [ ] New z-index values use semantic layer scale.
- [ ] New controls reuse canonical tokens/components.
- [ ] Theme changes atmosphere, not interaction architecture.
- [ ] Meridian remains visually recognizable across campaign themes.

---

# 19. Design review checklist for agents

Before implementing a major tabletop feature, answer:

1. In which mode is this feature relevant?
2. Is it persistent, contextual, Drawer-level, Popover-level, Inspector-level or Workspace-level?
3. Which safe zone does it own?
4. What existing UI disappears or yields space when it opens?
5. Can the user discover it without documentation or memorized shortcut?
6. Is any part of the proposal game-system-specific? If yes, can it be supplied by Game System metadata instead?
7. Is any part only decorative? If yes, should it live in the campaign Theme rather than Meridian Core?
8. Does it introduce a new primitive or duplicate an existing canonical component?

If these questions do not have clear answers, the feature is not ready to enter the Meridian tabletop shell.
