-- TTV v0.5.1: one classic fantasy sheet by default, extensible by the campaign GM.

create or replace function public.classic_fantasy_sheet_schema()
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $function$
  select $json${"version":1,"sections":[{"id":"classic-identity","title":"Основное","slot":"identity","fields":[{"id":"classic-class_level","key":"class_level","label":"Класс и уровень","type":"text","hint":""},{"id":"classic-background","key":"background","label":"Предыстория","type":"text","hint":""},{"id":"classic-ancestry","key":"ancestry","label":"Народ / происхождение","type":"text","hint":""},{"id":"classic-alignment","key":"alignment","label":"Мировоззрение","type":"text","hint":""},{"id":"classic-experience","key":"experience","label":"Опыт","type":"number","hint":""}]},{"id":"classic-training","title":"Подготовка","slot":"training","fields":[{"id":"classic-inspiration","key":"inspiration","label":"Вдохновение","type":"checkbox","hint":""},{"id":"classic-proficiency_bonus","key":"proficiency_bonus","label":"Бонус мастерства","type":"number","hint":""}]},{"id":"classic-abilities","title":"Характеристики","slot":"abilities","fields":[{"id":"classic-strength","key":"strength","label":"Сила","type":"ability","hint":""},{"id":"classic-dexterity","key":"dexterity","label":"Ловкость","type":"ability","hint":""},{"id":"classic-constitution","key":"constitution","label":"Телосложение","type":"ability","hint":""},{"id":"classic-intelligence","key":"intelligence","label":"Интеллект","type":"ability","hint":""},{"id":"classic-wisdom","key":"wisdom","label":"Мудрость","type":"ability","hint":""},{"id":"classic-charisma","key":"charisma","label":"Харизма","type":"ability","hint":""}]},{"id":"classic-saves","title":"Спасброски","slot":"saves","fields":[{"id":"classic-strength_save","key":"strength_save","label":"Сила","type":"skill","hint":""},{"id":"classic-dexterity_save","key":"dexterity_save","label":"Ловкость","type":"skill","hint":""},{"id":"classic-constitution_save","key":"constitution_save","label":"Телосложение","type":"skill","hint":""},{"id":"classic-intelligence_save","key":"intelligence_save","label":"Интеллект","type":"skill","hint":""},{"id":"classic-wisdom_save","key":"wisdom_save","label":"Мудрость","type":"skill","hint":""},{"id":"classic-charisma_save","key":"charisma_save","label":"Харизма","type":"skill","hint":""}]},{"id":"classic-skills","title":"Навыки","slot":"skills","fields":[{"id":"classic-acrobatics","key":"acrobatics","label":"Акробатика","type":"skill","hint":"Ловкость"},{"id":"classic-animal_handling","key":"animal_handling","label":"Уход за животными","type":"skill","hint":"Мудрость"},{"id":"classic-arcana","key":"arcana","label":"Магия","type":"skill","hint":"Интеллект"},{"id":"classic-athletics","key":"athletics","label":"Атлетика","type":"skill","hint":"Сила"},{"id":"classic-deception","key":"deception","label":"Обман","type":"skill","hint":"Харизма"},{"id":"classic-history","key":"history","label":"История","type":"skill","hint":"Интеллект"},{"id":"classic-insight","key":"insight","label":"Проницательность","type":"skill","hint":"Мудрость"},{"id":"classic-intimidation","key":"intimidation","label":"Запугивание","type":"skill","hint":"Харизма"},{"id":"classic-investigation","key":"investigation","label":"Анализ","type":"skill","hint":"Интеллект"},{"id":"classic-medicine","key":"medicine","label":"Медицина","type":"skill","hint":"Мудрость"},{"id":"classic-nature","key":"nature","label":"Природа","type":"skill","hint":"Интеллект"},{"id":"classic-perception","key":"perception","label":"Внимательность","type":"skill","hint":"Мудрость"},{"id":"classic-performance","key":"performance","label":"Выступление","type":"skill","hint":"Харизма"},{"id":"classic-persuasion","key":"persuasion","label":"Убеждение","type":"skill","hint":"Харизма"},{"id":"classic-religion","key":"religion","label":"Религия","type":"skill","hint":"Интеллект"},{"id":"classic-sleight_of_hand","key":"sleight_of_hand","label":"Ловкость рук","type":"skill","hint":"Ловкость"},{"id":"classic-stealth","key":"stealth","label":"Скрытность","type":"skill","hint":"Ловкость"},{"id":"classic-survival","key":"survival","label":"Выживание","type":"skill","hint":"Мудрость"}]},{"id":"classic-combat","title":"Бой","slot":"combat","fields":[{"id":"classic-armor_class","key":"armor_class","label":"Класс защиты","type":"number","hint":""},{"id":"classic-initiative","key":"initiative","label":"Инициатива","type":"number","hint":""},{"id":"classic-speed","key":"speed","label":"Скорость","type":"number","hint":""}]},{"id":"classic-health","title":"Здоровье","slot":"health","fields":[{"id":"classic-hit_points","key":"hit_points","label":"Хиты","type":"resource","hint":""},{"id":"classic-temporary_hit_points","key":"temporary_hit_points","label":"Временные хиты","type":"number","hint":""},{"id":"classic-hit_dice","key":"hit_dice","label":"Кости хитов","type":"text","hint":"Например: 3к8"},{"id":"classic-death_saves","key":"death_saves","label":"Спасброски от смерти","type":"text","hint":"Успехи / провалы"}]},{"id":"classic-traits","title":"Личность","slot":"traits","fields":[{"id":"classic-personality_traits","key":"personality_traits","label":"Черты характера","type":"textarea","hint":""},{"id":"classic-ideals","key":"ideals","label":"Идеалы","type":"textarea","hint":""},{"id":"classic-bonds","key":"bonds","label":"Привязанности","type":"textarea","hint":""},{"id":"classic-flaws","key":"flaws","label":"Слабости","type":"textarea","hint":""}]},{"id":"classic-attacks","title":"Атаки и заклинания","slot":"attacks","fields":[{"id":"classic-attacks_and_spells","key":"attacks_and_spells","label":"Атаки, бонусы и урон","type":"textarea","hint":"Название · бонус атаки · урон / эффект"}]},{"id":"classic-proficiencies","title":"Владения и языки","slot":"proficiencies","fields":[{"id":"classic-proficiencies_and_languages","key":"proficiencies_and_languages","label":"Прочие владения и языки","type":"textarea","hint":""}]},{"id":"classic-equipment","title":"Снаряжение","slot":"equipment","fields":[{"id":"classic-equipment_notes","key":"equipment_notes","label":"Снаряжение и монеты","type":"textarea","hint":""}]},{"id":"classic-features","title":"Умения и особенности","slot":"features","fields":[{"id":"classic-features_and_traits","key":"features_and_traits","label":"Умения, особенности и заметки","type":"textarea","hint":""}]}]}$json$::jsonb
$function$;

revoke all on function public.classic_fantasy_sheet_schema() from public, anon, authenticated;

-- Upgrade existing default templates without dropping campaign-specific fields.
with classic as (
  select public.classic_fantasy_sheet_schema() as schema
)
update public.actor_sheet_templates as template
set
  name = 'Классический лист',
  schema = jsonb_set(
    classic.schema,
    '{sections}',
    (classic.schema->'sections') || coalesce(template.schema->'sections', '[]'::jsonb)
  ),
  updated_at = now()
from classic
where template.is_default
  and not exists (
    select 1
    from jsonb_array_elements(coalesce(template.schema->'sections', '[]'::jsonb)) as section
    where section->>'id' = 'classic-identity'
  );

-- Campaigns that never created a sheet receive the classic sheet automatically.
insert into public.actor_sheet_templates(campaign_id, name, schema, is_default)
select campaign.id, 'Классический лист', public.classic_fantasy_sheet_schema(), true
from public.campaigns as campaign
where not exists (
  select 1
  from public.actor_sheet_templates as template
  where template.campaign_id = campaign.id
    and template.is_default
);

-- Existing heroes without an assigned sheet inherit their campaign default.
update public.actors as actor
set
  sheet_template_id = template.id,
  updated_at = now()
from public.actor_sheet_templates as template
where actor.campaign_id = template.campaign_id
  and actor.sheet_template_id is null
  and template.is_default;

create or replace function public.create_campaign(
  campaign_name text,
  campaign_description text default null,
  campaign_system_id text default 'generic-fantasy',
  campaign_setting_id text default 'medieval-fantasy',
  campaign_theme_id text default 'dark-fantasy'
)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $function$
declare
  created public.campaigns;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if nullif(btrim(campaign_name), '') is null then raise exception 'campaign name is required'; end if;

  insert into public.campaigns(owner_id, name, description, system_id, setting_id, theme_id)
  values(auth.uid(), btrim(campaign_name), campaign_description, campaign_system_id, campaign_setting_id, campaign_theme_id)
  returning * into created;

  insert into public.campaign_members(campaign_id, user_id, role)
  values(created.id, auth.uid(), 'owner');

  insert into public.actor_sheet_templates(campaign_id, name, schema, is_default)
  values(created.id, 'Классический лист', public.classic_fantasy_sheet_schema(), true);

  return created;
end;
$function$;

revoke all on function public.create_campaign(text, text, text, text, text) from public, anon;
grant execute on function public.create_campaign(text, text, text, text, text) to authenticated;

create or replace function public.save_actor_sheet_template(
  target_campaign uuid,
  target_template uuid,
  template_name text,
  template_schema jsonb,
  make_default boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  result_id uuid;
  should_default boolean;
begin
  if not public.is_campaign_gm(target_campaign) then raise exception 'campaign access denied'; end if;
  if nullif(btrim(template_name), '') is null then raise exception 'template name is required'; end if;
  if jsonb_typeof(template_schema) <> 'object' or jsonb_typeof(template_schema->'sections') <> 'array' then
    raise exception 'invalid sheet schema';
  end if;
  if octet_length(template_schema::text) > 65536 then raise exception 'sheet schema is too large'; end if;
  if jsonb_array_length(template_schema->'sections') > 20 then raise exception 'too many sheet sections'; end if;

  should_default := coalesce(make_default, false)
    or not exists(select 1 from public.actor_sheet_templates where campaign_id = target_campaign);

  if should_default then
    update public.actor_sheet_templates
    set is_default = false, updated_at = now()
    where campaign_id = target_campaign and is_default;
  end if;

  if target_template is null then
    insert into public.actor_sheet_templates(campaign_id, name, schema, is_default)
    values(target_campaign, btrim(template_name), template_schema, should_default)
    returning id into result_id;
  else
    update public.actor_sheet_templates
    set
      name = btrim(template_name),
      schema = template_schema,
      is_default = case when should_default then true else is_default end,
      updated_at = now()
    where id = target_template and campaign_id = target_campaign
    returning id into result_id;

    if result_id is null then raise exception 'template not found'; end if;
  end if;

  if should_default then
    update public.actors
    set sheet_template_id = result_id, updated_at = now()
    where campaign_id = target_campaign and sheet_template_id is null;
  end if;

  return result_id;
end;
$function$;

revoke all on function public.save_actor_sheet_template(uuid, uuid, text, jsonb, boolean) from public, anon;
grant execute on function public.save_actor_sheet_template(uuid, uuid, text, jsonb, boolean) to authenticated;

