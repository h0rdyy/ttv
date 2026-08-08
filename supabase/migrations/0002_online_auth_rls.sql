-- TTV v0.2 online auth/RLS layer.

revoke all on function public.is_campaign_member(uuid) from public, anon, authenticated;
revoke all on function public.is_campaign_gm(uuid) from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email,''),'@',1), ''), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.create_campaign(
  campaign_name text,
  campaign_description text default null,
  campaign_system_id text default 'generic-fantasy',
  campaign_setting_id text default 'medieval-fantasy',
  campaign_theme_id text default 'dark-fantasy'
)
returns public.campaigns language plpgsql security definer set search_path=public as $$
declare created public.campaigns;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if nullif(btrim(campaign_name),'') is null then raise exception 'campaign name is required'; end if;
  insert into public.campaigns(owner_id,name,description,system_id,setting_id,theme_id)
  values(auth.uid(),btrim(campaign_name),campaign_description,campaign_system_id,campaign_setting_id,campaign_theme_id)
  returning * into created;
  insert into public.campaign_members(campaign_id,user_id,role) values(created.id,auth.uid(),'owner');
  return created;
end;
$$;
revoke all on function public.create_campaign(text,text,text,text,text) from public, anon;
grant execute on function public.create_campaign(text,text,text,text,text) to authenticated;

create or replace function public.campaign_for_scene(target_scene uuid) returns uuid language sql stable security definer set search_path=public as $$ select campaign_id from public.scenes where id=target_scene $$;
create or replace function public.campaign_for_inventory(target_inventory uuid) returns uuid language sql stable security definer set search_path=public as $$ select campaign_id from public.inventories where id=target_inventory $$;
create or replace function public.campaign_for_container(target_container uuid) returns uuid language sql stable security definer set search_path=public as $$ select i.campaign_id from public.inventory_containers c join public.inventories i on i.id=c.inventory_id where c.id=target_container $$;
create or replace function public.campaign_for_book(target_book uuid) returns uuid language sql stable security definer set search_path=public as $$ select campaign_id from public.books where id=target_book $$;
revoke all on function public.campaign_for_scene(uuid) from public, anon, authenticated;
revoke all on function public.campaign_for_inventory(uuid) from public, anon, authenticated;
revoke all on function public.campaign_for_container(uuid) from public, anon, authenticated;
revoke all on function public.campaign_for_book(uuid) from public, anon, authenticated;

create policy scene_tokens_member_read on public.scene_tokens for select using (public.is_campaign_member(public.campaign_for_scene(scene_id)) and (not hidden or public.is_campaign_gm(public.campaign_for_scene(scene_id))));
create policy scene_tokens_gm_write on public.scene_tokens for all using (public.is_campaign_gm(public.campaign_for_scene(scene_id))) with check (public.is_campaign_gm(public.campaign_for_scene(scene_id)));
create policy scene_tokens_player_move_own on public.scene_tokens for update using (exists(select 1 from public.actors a where a.id=actor_id and a.owner_user_id=(select auth.uid()))) with check (exists(select 1 from public.actors a where a.id=actor_id and a.owner_user_id=(select auth.uid())));
create policy inventories_member_read on public.inventories for select using (public.is_campaign_member(campaign_id));
create policy inventories_gm_write on public.inventories for all using (public.is_campaign_gm(campaign_id)) with check (public.is_campaign_gm(campaign_id));
create policy containers_member_read on public.inventory_containers for select using (public.is_campaign_member(public.campaign_for_inventory(inventory_id)));
create policy containers_gm_write on public.inventory_containers for all using (public.is_campaign_gm(public.campaign_for_inventory(inventory_id))) with check (public.is_campaign_gm(public.campaign_for_inventory(inventory_id)));
create policy item_instances_member_read on public.item_instances for select using (public.is_campaign_member(public.campaign_for_container(container_id)));
create policy item_instances_gm_write on public.item_instances for all using (public.is_campaign_gm(public.campaign_for_container(container_id))) with check (public.is_campaign_gm(public.campaign_for_container(container_id)));
create policy book_pages_member_read on public.book_pages for select using (public.is_campaign_member(public.campaign_for_book(book_id)) and (visibility <> 'gm' or public.is_campaign_gm(public.campaign_for_book(book_id))));
create policy book_pages_gm_write on public.book_pages for all using (public.is_campaign_gm(public.campaign_for_book(book_id))) with check (public.is_campaign_gm(public.campaign_for_book(book_id)));
create policy roll_tables_member_read on public.roll_tables for select using (public.is_campaign_member(campaign_id));
create policy roll_tables_gm_write on public.roll_tables for all using (public.is_campaign_gm(campaign_id)) with check (public.is_campaign_gm(campaign_id));
