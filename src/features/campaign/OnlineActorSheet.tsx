// Legacy sheet UI was retired in the immersion lab.
// Character data is edited through PlayerCharacterWindow; this type stays here
// temporarily so existing server/table props do not need a parallel migration.
export type SheetActor = {
  id: string;
  campaign_id: string;
  owner_user_id: string | null;
  type: string;
  name: string;
  subtitle: string;
  avatar: string;
  system_data: Record<string, any>;
  sheet_template_id: string | null;
};
