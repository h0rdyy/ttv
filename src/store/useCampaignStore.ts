'use client';

import { create } from 'zustand';
import { inventories as seedInventories } from '@/data/demo';
import type { Inventory } from '@/domain/types';

type SidebarTab = 'party' | 'combat' | 'inventory' | 'npc' | 'notes';
type WorkshopTab = 'items' | 'npc' | 'loot' | 'tables';

interface ActionRecord {
  label: string;
  undo?: () => void;
}

interface CampaignStore {
  selectedActorId: string;
  selectedItemId: string;
  sidebarTab: SidebarTab;
  workshopTab: WorkshopTab;
  workshopOpen: boolean;
  builderOpen: boolean;
  inventories: Inventory[];
  lastAction?: ActionRecord;
  setActor: (id: string) => void;
  setItem: (id: string) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setWorkshopTab: (tab: WorkshopTab) => void;
  setWorkshopOpen: (value: boolean) => void;
  setBuilderOpen: (value: boolean) => void;
  giveItem: (actorId: string, definitionId: string, quantity: number) => void;
  moveItem: (inventoryId: string, instanceId: string, targetContainerId: string) => void;
  undo: () => void;
}

const cloneInventories = (value: Inventory[]) => JSON.parse(JSON.stringify(value)) as Inventory[];

export const useCampaignStore = create<CampaignStore>((set, get) => ({
  selectedActorId: 'alvis',
  selectedItemId: 'flame-sword',
  sidebarTab: 'inventory',
  workshopTab: 'items',
  workshopOpen: true,
  builderOpen: false,
  inventories: cloneInventories(seedInventories),

  setActor: (selectedActorId) => set({ selectedActorId }),
  setItem: (selectedItemId) => set({ selectedItemId }),
  setSidebarTab: (sidebarTab) => set({ sidebarTab }),
  setWorkshopTab: (workshopTab) => set({ workshopTab }),
  setWorkshopOpen: (workshopOpen) => set({ workshopOpen }),
  setBuilderOpen: (builderOpen) => set({ builderOpen }),

  giveItem: (actorId, definitionId, quantity) => {
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

  undo: () => get().lastAction?.undo?.(),
}));
