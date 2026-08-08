export type ActorType = 'player' | 'npc' | 'creature' | 'vehicle' | 'companion' | 'summon';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'very-rare' | 'legendary' | 'artifact';

export type ThemeId = 'dark-fantasy' | 'grimdark' | 'medieval';

export interface ResourceValue {
  current: number;
  max: number;
}

export interface Actor {
  id: string;
  campaignId: string;
  type: ActorType;
  name: string;
  subtitle: string;
  avatar: string;
  systemData: Record<string, unknown> & {
    hp?: ResourceValue;
    armor?: number;
    level?: number;
  };
  inventoryId?: string;
}

export interface ItemEffect {
  id: string;
  name: string;
  description: string;
  icon?: string;
  trigger?: string;
  operation?: string;
  payload?: Record<string, unknown>;
}

export interface ItemDefinition {
  id: string;
  systemId: string;
  name: string;
  description: string;
  category: string;
  rarity: Rarity;
  icon: string;
  weight?: number;
  price?: number;
  currency?: string;
  source?: string;
  properties: Record<string, unknown>;
  effects: ItemEffect[];
}

export interface ItemInstance {
  id: string;
  definitionId: string;
  quantity: number;
  customName?: string;
  containerId?: string;
  equipped?: boolean;
  state?: Record<string, unknown>;
}

export interface InventoryContainer {
  id: string;
  inventoryId: string;
  name: string;
  type: 'equipment' | 'container';
  capacity?: number;
  items: ItemInstance[];
}

export interface Inventory {
  id: string;
  ownerActorId: string;
  containers: InventoryContainer[];
}

export interface SceneToken {
  id: string;
  actorId: string;
  x: number;
  y: number;
  enemy?: boolean;
}

export interface Scene {
  id: string;
  campaignId: string;
  name: string;
  tokens: SceneToken[];
}

export interface Campaign {
  id: string;
  name: string;
  systemId: string;
  settingId: string;
  themeId: ThemeId;
}

export interface FieldSchema {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea';
  options?: string[];
}

export interface BuilderSectionSchema {
  id: string;
  title: string;
  fields: FieldSchema[];
}

export interface GameSystemDefinition {
  id: string;
  name: string;
  itemBuilder: Record<string, BuilderSectionSchema[]>;
}
