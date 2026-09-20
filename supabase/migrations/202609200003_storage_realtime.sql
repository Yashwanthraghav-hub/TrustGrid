-- Private attachments: no public buckets or public URLs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('report-evidence','report-evidence',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy evidence_insert on storage.objects for insert to authenticated with check(bucket_id='report-evidence' and exists(select 1 from public.report_attachments a where a.path=name and a.uploader_id=auth.uid() and private.can_report(a.organization_id,a.report_id)));
create policy evidence_select on storage.objects for select to authenticated using(bucket_id='report-evidence' and exists(select 1 from public.report_attachments a where a.path=name and private.can_report(a.organization_id,a.report_id)));
create policy evidence_delete on storage.objects for delete to authenticated using(bucket_id='report-evidence' and exists(select 1 from public.report_attachments a where a.path=name and a.uploader_id=auth.uid() and private.can_report(a.organization_id,a.report_id)));
create or replace function public.tg_attachment(p_org uuid,p_report uuid,p_path text,p_mime text,p_size integer) returns uuid language plpgsql security definer set search_path='' as $$declare rid uuid;begin
 perform 1 from public.organizations where id=p_org for update;
 if private.role(p_org) is null or not exists(select 1 from public.reports where id=p_report and organization_id=p_org and author_id=auth.uid()) then raise exception 'FORBIDDEN';end if;
 if p_path not like p_org::text||'/'||p_report::text||'/%' or p_path like '%..%' then raise exception 'INVALID_PATH';end if;
 if(select count(*) from public.report_attachments where report_id=p_report)>=3 then raise exception 'ATTACHMENT_LIMIT';end if;
 insert into public.report_attachments(organization_id,report_id,uploader_id,path,mime,size) values(p_org,p_report,auth.uid(),p_path,p_mime,p_size) returning id into rid;
 insert into public.audit_events(organization_id,actor_id,action,entity_id)values(p_org,auth.uid(),'attachment.create',rid);return rid;end$$;
revoke all on function public.tg_attachment(uuid,uuid,text,text,integer) from public,anon;
grant execute on function public.tg_attachment(uuid,uuid,text,text,integer) to authenticated;
create or replace function public.tg_profile(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 update public.profiles set display_name=p_data->>'display_name',preferred_language=coalesce(p_data->>'preferred_language','en'),timezone=coalesce(p_data->>'timezone','Asia/Kolkata'),service_area=coalesce(p_data->>'service_area',''),theme=coalesce(p_data->>'theme','system'),onboarded=true,updated_at=now() where id=auth.uid() returning to_jsonb(profiles.*) into result;return result;end$$;
revoke all on function public.tg_profile(jsonb) from public,anon;
grant execute on function public.tg_profile(jsonb) to authenticated;
do $$begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
 alter publication supabase_realtime add table public.notifications,public.reports,public.delivery_tasks,public.inventory_lots;
 end if;
end$$;
