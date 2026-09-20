insert into public.organizations(name,service_areas,settings,is_demo,joining_policy)
select 'TrustGrid Community Pilot',array['Community North','Community South'],'{"hold_minutes":30,"freshness_hours":24}'::jsonb,false,'public'
where not exists(select 1 from public.organizations where name='TrustGrid Community Pilot');
