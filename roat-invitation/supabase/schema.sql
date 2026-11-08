-- Roat invitation MVP schema
-- Run this in Supabase SQL Editor after creating a project.

create extension if not exists pgcrypto;

create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  attending boolean not null,
  guest_count integer not null check (guest_count between 1 and 20),
  created_at timestamptz not null default now()
);

create table if not exists public.song_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  song text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.voice_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  storage_path text not null unique,
  duration_seconds integer not null check (duration_seconds between 15 and 30),
  created_at timestamptz not null default now()
);

alter table public.rsvps enable row level security;
alter table public.song_submissions enable row level security;
alter table public.voice_messages enable row level security;

-- Anyone with the invitation link can submit. No public read policies are created.
create policy "Anyone can submit an RSVP"
on public.rsvps for insert to anon, authenticated
with check (true);

create policy "Anyone can submit a song"
on public.song_submissions for insert to anon, authenticated
with check (true);

create policy "Anyone can submit a voice message record"
on public.voice_messages for insert to anon, authenticated
with check (duration_seconds between 15 and 30);

-- Private audio bucket: no public read access.
insert into storage.buckets (id, name, public)
values ('voice-messages', 'voice-messages', false)
on conflict (id) do nothing;

create policy "Anyone can upload voice messages"
on storage.objects for insert to anon, authenticated
with check (bucket_id = 'voice-messages');

-- Family admin read access: replace with the email address used for your family admin login.
-- These policies intentionally grant read access only to that authenticated email.
create policy "Family can read RSVPs"
on public.rsvps for select to authenticated
using ((auth.jwt() ->> 'email') = 'REPLACE_WITH_FAMILY_ADMIN_EMAIL');

create policy "Family can read song submissions"
on public.song_submissions for select to authenticated
using ((auth.jwt() ->> 'email') = 'REPLACE_WITH_FAMILY_ADMIN_EMAIL');

create policy "Family can read voice message records"
on public.voice_messages for select to authenticated
using ((auth.jwt() ->> 'email') = 'REPLACE_WITH_FAMILY_ADMIN_EMAIL');

create policy "Family can download private voice messages"
on storage.objects for select to authenticated
using (
  bucket_id = 'voice-messages'
  and (auth.jwt() ->> 'email') = 'REPLACE_WITH_FAMILY_ADMIN_EMAIL'
);
