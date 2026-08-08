'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { inventories as seedInventories, items as seedItems, scene } from '@/data/demo';
import type { Inventory, ItemDefinition } from '@/domain/types';
import type { CampaignPresetId } from '@/config/campaignPresets';

type SidebarTab = 'party' | 'combat' | 'inventory' | 'npc' | 'notes';
type WorkshopTab = 'items' | 'npc' | 'loot' | 'tables';

interface ActionRecord {
  label: string;
  undo?: () => void;
}

interface TokenPosition {
  x: number;
  y: number;
}

interface CampaignStore {
  presetId: CampaignPresetId;
  selectedActorId: string;
  selectedItemId: string;
  sidebarTab: SidebarTab;
  workshopTab: WorkshopTab;
  workshopOpen: boolean;
  builderOpen: boolean;
  mapGrid: boolean;
  mapFog: boolean;
  tokenPositions: Record<string, TokenPosition>;
  inventories: Inventory[];
  itemDefinitions: ItemDefinition[];
  notes: string[];
  combatRound: number;
  combatTurn: number;
  lastAction?: ActionRecord;
  setPresetId: (id: CampaignPresetId) => void;
  setActor: (id: string) => void;
  setItem: (id: string) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setWorkshopTab: (tab: WorkshopTab) => void;
  setWorkshopOpen: (value: boolean) => void;
  setBuilderOpen: (value: boolean) => void;
  toggleMapGrid: () => void;
  toggleMapFog: () => void;
  moveToken: (tokenId: string, x: number, y: number) => void;
  upsertItem: (item: ItemDefinition) => void;
  duplicateItem: (id: string) => void;
  deleteItem: (id: string) => void;
  giveItem: (actorId: string, definitionId: string, quantity: number) => void;
  moveItem: (inventoryId: string, instanceId: string, targetContainerId: string) => void;
  addNote: (text: string) => void;
  removeNote: (index: number) => void;
  nextCombatTurn: (participants: number) => void;
  resetDemo: () => void;
  undo: () => void;
}

const cloneInventories = (value: Inventory[]) => JSON.parse(JSON.stringify(value)) as Inventory[];
const cloneItems = (value: ItemDefinition[]) => JSON.parse(JSON.stringify(value)) as ItemDefinition[];
const seedTokenPositions = () => Object.fromEntries(scene.tokens.map((token) => [token.id, { x: token.x, y: token.y }])) as Record<string, TokenPosition>;

export const useCampaignStore = create<CampaignStore>()(
  persist(
    (set, get) => ({
      presetId: 'medieval-fantasy',
      selectedActorId: 'alvis',
      selectedItemId: 'flame-sword',
      sidebarTab: 'inventory',
      workshopTab: 'items',
      workshopOpen: true,
      builderOpen: false,
      mapGrid: true,
      mapFog: false,
      tokenPositions: seedTokenPositions(),
      inventories: cloneInventories(seedInventories),
      itemDefinitions: cloneItems(seedItems),
      notes: ['Игроки встретили торговца Брина.', 'Король подозревает Альвиса.', 'Код двери в старой башне: 4217.'],
      combatRound: 1,
      combatTurn: 0,

      setPresetId: (presetId) => set({ presetId }),
      setActor: (selectedActorId) => set({ selectedActorId }),
      setItem: (selectedItemId) => set({ selectedItemId }),
      setSidebarTab: (sidebarTab) => set({ sidebarTab }),
      setWorkshopTab: (workshopTab) => set({ workshopTab }),
      setWorkshopOpen: (workshopOpen) => set({ workshopOpen }),
      setBuilderOpen: (builderOpen) => set({ builderOpen }),
      toggleMapGrid: () => set((state) => ({ mapGrid: !state.mapGrid })),
      toggleMapFog: () => set((state) => ({ mapFog: !state.mapFog })),
      moveToken: (tokenId, x, y) => set((state) => ({
        tokenPositions: { ...state.tokenPositions, [tokenId]: { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) } },
      })),

      upsertItem: (item) => set((state) => {
        const exists = state.itemDefinitions.some((x) => x.id === item.id);
        return {
          itemDefinitions: exists ? state.itemDefinitions.map((x) => x.id === item.id ? item : x) : [item, ...state.itemDefinitions],
          selectedItemId: item.id,
          builderOpen: false,
          lastAction: { label: exists ? `Изменён предмет: ${item.name}` : `Создан предмет: ${item.name}` }
        };
      }),

      duplicateItem: (id) => set((state) => {
        const source = state.itemDefinitions.find((x) => x.id === id);
        if (!source) return state;
        const copy: ItemDefinition = {
          ...JSON.parse(JSON.stringify(source)),
          id: `${source.id}-copy-${Date.now()}`,
          name: `${source.name} — копия`,
          source: 'Собственный'
        };
        return { itemDefinitions: [copy, ...state.itemDefinitions], selectedItemId: copy.id, lastAction: { label: `Создана копия: ${source.name}` } };
      }),

      deleteItem: (id) => set((state) => {
        const source = state.itemDefinitions.find((x) => x.id === id);
        if (!source || state.itemDefinitions.length <= 1) return state;
        const next = state.itemDefinitions.filter((x) => x.id !== id);
        return { itemDefinitions: next, selectedItemId: next[0].id, builderOpen: false, lastAction: { label: `Удалён предмет: ${source.name}` } };
      }),

      giveItem: (actorId, definitionId, quantity) => {
        if (!Number.isFinite(quantity) || quantity <= 0) return;
        const previous = cloneInventories(get().inventories);
        const next = cloneInventories(previous);
        const inventory = next.find((x) => x.ownerActorId === actorId);
        if (!inventory) return;
        const container = inventory.containers.find((x) => x.type === 'container') ?? inventory.containers[0];
        if (!container) return;
        const existing = container.items.find((x) => x.definitionId === definitionId);
        if (existing) existing.quantity += quantity;
        else container.items.push({ id: crypto.randomUUID(), definitionId, quantity, containerId: container.id });
        set({
          inventories: next,
          lastAction: {
            label: `Выдан предмет ×${quantity}`,
            undo: () => set({ inventories: previous, lastAction: undefined })
          }
        });
      },

      moveItem: (inventoryId, instanceId, targetContainerId) => {
        const previous = cloneInventories(get().inventories);
        const next = cloneInventories(previous);
        const inventory = next.find((x) => x.id === inventoryId);
        if (!inventory) return;
        const from = inventory.containers.find((c) => c.items.some((i) => i.id === instanceId));
        const target = inventory.containers.find((c) => c.id === targetContainerId);
        if (!from || !target || from.id === target.id) return;
        const index = from.items.findIndex((x) => x.id === instanceId);
        const [item] = from.items.splice(index, 1);
        if (!item) return;
        item.containerId = target.id;
        item.equipped = target.type === 'equipment';
        target.items.push(item);
        set({
          inventories: next,
          lastAction: {
            label: `Перемещён предмет: ${from.name} → ${target.name}`,
            undo: () => set({ inventories: previous, lastAction: undefined })
          }
        });
      },

      addNote: (text) => {
        const clean = text.trim();
        if (!clean) return;
        set((state) => ({ notes: [clean, ...state.notes], lastAction: { label: 'Добавлена заметка' } }));
      },
      removeNote: (index) => set((state) => ({ notes: state.notes.filter((_, i) => i !== index) })),

      nextCombatTurn: (participants) => set((state) => {
        if (participants <= 0) return state;
        const nextTurn = state.combatTurn + 1;
        if (nextTurn >= participants) return { combatTurn: 0, combatRound: state.combatRound + 1 };
        return { combatTurn: nextTurn };
      }),

      resetDemo: () => set({
        presetId: 'medieval-fantasy',
        selectedActorId: 'alvis',
        selectedItemId: 'flame-sword',
        sidebarTab: 'inventory',
        workshopTab: 'items',
        workshopOpen: true,
        builderOpen: false,
        mapGrid: true,
        mapFog: false,
        tokenPositions: seedTokenPositions(),
        inventories: cloneInventories(seedInventories),
        itemDefinitions: cloneItems(seedItems),
        notes: ['Игроки встретили торговца Брина.', 'Король подозревает Альвиса.', 'Код двери в старой башне: 4217.'],
        combatRound: 1,
        combatTurn: 0,
        lastAction: undefined,
      }),

      undo: () => get().lastAction?.undo?.(),
    }),
    {
      name: 'ttv-campaign-v1',
      partialize: (state) => ({
        presetId: state.presetId,
        selectedActorId: state.selectedActorId,
        selectedItemId: state.selectedItemId,
        sidebarTab: state.sidebarTab,
        workshopTab: state.workshopTab,
        workshopOpen: state.workshopOpen,
        mapGrid: state.mapGrid,
        mapFog: state.mapFog,
        tokenPositions: state.tokenPositions,
        inventories: state.inventories,
        itemDefinitions: state.itemDefinitions,
        notes: state.notes,
        combatRound: state.combatRound,
        combatTurn: state.combatTurn,
      }),
    }
  )
);
