alter table public.players
  add column if not exists jersey_number text,
  add column if not exists birth_certificate_url text,
  add column if not exists report_card_url text;

insert into storage.buckets (id, name, public)
select 'player-documents', 'player-documents', true
where not exists (
  select 1
  from storage.buckets
  where id = 'player-documents'
);

drop policy if exists "Public read player documents" on storage.objects;
create policy "Public read player documents"
on storage.objects
for select
to public
using (bucket_id = 'player-documents');

drop policy if exists "Public upload player documents" on storage.objects;
create policy "Public upload player documents"
on storage.objects
for insert
to public
with check (bucket_id = 'player-documents');

drop policy if exists "Public update player documents" on storage.objects;
create policy "Public update player documents"
on storage.objects
for update
to public
using (bucket_id = 'player-documents')
with check (bucket_id = 'player-documents');
