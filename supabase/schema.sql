
-- PPDB SMK Negeri 1 Bandung
-- Jalankan pada project Supabase BARU melalui SQL Editor.

create extension if not exists pgcrypto;

-- PROFIL PENGGUNA
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'student'
    check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'student'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- JALUR PENDAFTARAN
create table public.admission_tracks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  quota integer not null default 0 check (quota >= 0),
  is_open boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.admission_tracks (name, description, quota, is_open)
values
  ('Zonasi', 'Jalur berdasarkan ketentuan domisili resmi.', 0, false),
  ('Prestasi', 'Jalur berdasarkan ketentuan prestasi resmi.', 0, false),
  ('Afirmasi', 'Jalur berdasarkan ketentuan afirmasi resmi.', 0, false);

-- PENDAFTARAN SISWA
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique
    references public.profiles(id) on delete cascade,
  registration_number text unique,
  full_name text not null,
  nisn text not null,
  birth_date date not null,
  address text not null,
  track_id uuid not null references public.admission_tracks(id),
  status text not null default 'draft'
    check (
      status in (
        'draft', 'submitted', 'verified',
        'revision', 'accepted', 'rejected'
      )
    ),
  revision_note text,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- DOKUMEN
create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null
    references public.applications(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null,
  file_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0),
  verification_status text not null default 'pending'
    check (
      verification_status in ('pending', 'verified', 'revision', 'rejected')
    ),
  note text,
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- PENGUMUMAN
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  is_published boolean not null default false,
  published_by uuid references public.profiles(id),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

-- RIWAYAT STATUS
create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null
    references public.applications(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  old_status text,
  new_status text not null,
  note text,
  created_at timestamptz not null default now()
);

-- CEK ROLE PANITIA DI SERVER
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- IZIN AKSES TABEL
alter table public.profiles enable row level security;
alter table public.admission_tracks enable row level security;
alter table public.applications enable row level security;
alter table public.application_documents enable row level security;
alter table public.announcements enable row level security;
alter table public.application_events enable row level security;

grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

grant select on public.admission_tracks to anon, authenticated;
grant select, insert, update on public.applications to authenticated;
grant select, insert on public.application_documents to authenticated;
grant select on public.announcements to anon, authenticated;
grant select on public.application_events to authenticated;

-- PROFIL
create policy "Users read own profile or admins read all"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));

create policy "Users update own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (
  id = (select auth.uid())
  and role = 'student'
);

-- JALUR
create policy "Anyone can read open tracks"
on public.admission_tracks for select to anon, authenticated
using (is_open = true or (select public.is_admin()));

create policy "Admins manage tracks"
on public.admission_tracks for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- PENDAFTARAN
create policy "Students read own applications admins read all"
on public.applications for select to authenticated
using (student_id = (select auth.uid()) or (select public.is_admin()));

create policy "Students create own draft"
on public.applications for insert to authenticated
with check (
  student_id = (select auth.uid())
  and status = 'draft'
);

create policy "Admins update applications"
on public.applications for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- DOKUMEN
create policy "Students and admins read documents"
on public.application_documents for select to authenticated
using (
  student_id = (select auth.uid())
  or (select public.is_admin())
);

create policy "Students add own documents"
on public.application_documents for insert to authenticated
with check (
  student_id = (select auth.uid())
  and exists (
    select 1 from public.applications a
    where a.id = application_id
      and a.student_id = (select auth.uid())
  )
);

-- PENGUMUMAN
create policy "Read published announcements"
on public.announcements for select to anon, authenticated
using (is_published = true or (select public.is_admin()));

create policy "Admins manage announcements"
on public.announcements for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- RIWAYAT
create policy "Students read own events admins read all"
on public.application_events for select to authenticated
using (
  (select public.is_admin())
  or exists (
    select 1 from public.applications a
    where a.id = application_id
      and a.student_id = (select auth.uid())
  )
);

create policy "Authenticated can insert events"
on public.application_events for insert to authenticated
with check (
  actor_id = (select auth.uid())
  and (
    (select public.is_admin())
    or exists (
      select 1 from public.applications a
      where a.id = application_id
        and a.student_id = (select auth.uid())
    )
  )
);

-- SIMPAN / KIRIM PENDAFTARAN
create or replace function public.save_student_application(
  p_full_name text,
  p_nisn text,
  p_birth_date date,
  p_address text,
  p_track_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Silakan masuk terlebih dahulu.';
  end if;

  if length(trim(p_full_name)) < 2
    or length(trim(p_nisn)) < 5
    or length(trim(p_address)) < 5 then
    raise exception 'Periksa kembali data pendaftaran.';
  end if;

  if p_birth_date is null or p_birth_date > current_date then
    raise exception 'Tanggal lahir tidak valid.';
  end if;

  if not exists (
    select 1 from public.admission_tracks
    where id = p_track_id and is_open = true
  ) then
    raise exception 'Jalur pendaftaran tidak tersedia.';
  end if;

  select id, status into v_id, v_status
  from public.applications
  where student_id = auth.uid()
  for update;

  if v_id is not null and v_status not in ('draft', 'revision') then
    raise exception 'Pendaftaran tidak dapat diubah pada status ini.';
  end if;

  insert into public.applications (
    student_id, full_name, nisn, birth_date,
    address, track_id, status, submitted_at
  )
  values (
    auth.uid(), trim(p_full_name), trim(p_nisn),
    p_birth_date, trim(p_address), p_track_id,
    'submitted', now()
  )
  on conflict (student_id) do update set
    full_name = excluded.full_name,
    nisn = excluded.nisn,
    birth_date = excluded.birth_date,
    address = excluded.address,
    track_id = excluded.track_id,
    status = 'submitted',
    submitted_at = now(),
    revision_note = null,
    updated_at = now()
  returning id into v_id;

  insert into public.application_events (
    application_id, actor_id, old_status, new_status, note
  )
  values (
    v_id, auth.uid(), v_status, 'submitted',
    'Pendaftaran disimpan atau dikirim.'
  );

  return v_id;
end;
$$;

revoke all on function public.save_student_application(text, text, date, text, uuid) from public;
grant execute on function public.save_student_application(text, text, date, text, uuid) to authenticated;

-- PANITIA MEMERIKSA PENDAFTARAN
create or replace function public.admin_review_application(
  p_application_id uuid,
  p_status text,
  p_revision_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_status text;
begin
  if not public.is_admin() then
    raise exception 'Akses khusus panitia.';
  end if;

  if p_status not in ('verified', 'revision', 'accepted', 'rejected') then
    raise exception 'Status tidak valid.';
  end if;

  select status into v_old_status
  from public.applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Pendaftaran tidak ditemukan.';
  end if;

  update public.applications
  set status = p_status,
      revision_note = p_revision_note,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = p_application_id;

  insert into public.application_events (
    application_id, actor_id, old_status, new_status, note
  )
  values (
    p_application_id, auth.uid(), v_old_status, p_status,
    p_revision_note
  );
end;
$$;

revoke all on function public.admin_review_application(uuid, text, text) from public;
grant execute on function public.admin_review_application(uuid, text, text) to authenticated;

-- PANITIA MENERBITKAN PENGUMUMAN
create or replace function public.publish_announcement(
  p_title text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Akses khusus panitia.';
  end if;

  if length(trim(p_title)) < 3 or length(trim(p_body)) < 3 then
    raise exception 'Judul dan isi pengumuman wajib diisi.';
  end if;

  insert into public.announcements (
    title, body, is_published, published_by, published_at
  )
  values (
    trim(p_title), trim(p_body), true, auth.uid(), now()
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.publish_announcement(text, text) from public;
grant execute on function public.publish_announcement(text, text) to authenticated;

-- STORAGE DOKUMEN PRIVATE
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ppdb-documents',
  'ppdb-documents',
  false,
  5242880,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy "Students read own stored files"
on storage.objects for select to authenticated
using (
  bucket_id = 'ppdb-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Students upload files in own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ppdb-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Admins read all stored files"
on storage.objects for select to authenticated
using (
  bucket_id = 'ppdb-documents'
  and (select public.is_admin())
);
