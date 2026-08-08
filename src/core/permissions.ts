export type CampaignRole = 'owner' | 'gm' | 'assistant-gm' | 'player' | 'spectator';

export type Permission =
  | 'campaign.manage'
  | 'scene.view'
  | 'scene.edit'
  | 'actor.view'
  | 'actor.edit-own'
  | 'actor.edit-any'
  | 'inventory.view-own'
  | 'inventory.view-any'
  | 'inventory.edit-own'
  | 'inventory.edit-any'
  | 'combat.manage'
  | 'workshop.use'
  | 'journal.edit';

const rolePermissions: Record<CampaignRole, Permission[]> = {
  owner: ['campaign.manage','scene.view','scene.edit','actor.view','actor.edit-own','actor.edit-any','inventory.view-own','inventory.view-any','inventory.edit-own','inventory.edit-any','combat.manage','workshop.use','journal.edit'],
  gm: ['scene.view','scene.edit','actor.view','actor.edit-own','actor.edit-any','inventory.view-own','inventory.view-any','inventory.edit-own','inventory.edit-any','combat.manage','workshop.use','journal.edit'],
  'assistant-gm': ['scene.view','scene.edit','actor.view','actor.edit-any','inventory.view-any','inventory.edit-any','combat.manage','workshop.use','journal.edit'],
  player: ['scene.view','actor.view','actor.edit-own','inventory.view-own','inventory.edit-own'],
  spectator: ['scene.view','actor.view'],
};

export function can(role: CampaignRole, permission: Permission) {
  return rolePermissions[role].includes(permission);
}

export function permissionsFor(role: CampaignRole) {
  return rolePermissions[role];
}
