-- CampusCycle database schema.
-- Run once in Supabase: SQL Editor > New query > paste this file > Run.

-- ============ Schools (so other campuses can be added later) ============
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);
insert into public.schools (name)
values ('Dr. Filemon C. Aguilar Memorial College of Las Piñas')
on conflict do nothing;

-- ============ Profiles (no email here; emails stay in auth.users) ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid references public.schools(id),
  display_name text not null check (char_length(display_name) between 1 and 40),
  program text not null default 'BSIS' check (char_length(program) between 2 and 30),
  affiliation text not null default 'student' check (affiliation in ('student','graduating','alumni')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, school_id, display_name, program, affiliation)
  values (
    new.id,
    (select id from public.schools order by name limit 1),
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1)), 40),
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'program'), ''), 'BSIS'), 30),
    case when new.raw_user_meta_data->>'affiliation' in ('student','graduating','alumni')
         then new.raw_user_meta_data->>'affiliation' else 'student' end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ Listings ============
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  school_id uuid references public.schools(id),
  type text not null check (type in ('sell','free','swap','looking_for')),
  title text not null check (char_length(title) between 3 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  category text not null check (category in ('books','electronics','accessories','materials','uniforms','other')),
  course text check (course is null or char_length(course) <= 60),
  condition text check (condition in ('new','like_new','good','fair')),
  price numeric(10,2) check (price is null or price >= 0),
  swap_for text check (swap_for is null or char_length(swap_for) <= 80),
  status text not null default 'active' check (status in ('active','done','hidden')),
  created_at timestamptz not null default now(),
  check (type <> 'sell' or price is not null)
);
create index listings_feed_idx on public.listings (status, created_at desc);
create index listings_user_idx on public.listings (user_id);

create or replace function public.before_listing_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.listings
      where user_id = new.user_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Daily posting limit reached (10 per day). Try again tomorrow.';
  end if;
  new.school_id := (select school_id from public.profiles where id = new.user_id);
  return new;
end $$;

create trigger listings_before_insert
  before insert on public.listings
  for each row execute function public.before_listing_insert();

-- ============ Listing images (max 3 per listing) ============
create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  path text not null,
  thumb_path text not null,
  position smallint not null default 0
);
create index listing_images_listing_idx on public.listing_images (listing_id);

create or replace function public.limit_listing_images()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.listing_images where listing_id = new.listing_id) >= 3 then
    raise exception 'A listing can have at most 3 photos.';
  end if;
  return new;
end $$;

create trigger listing_images_limit
  before insert on public.listing_images
  for each row execute function public.limit_listing_images();

-- ============ Contact requests ============
create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  from_user uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 500),
  contact text not null check (char_length(contact) between 3 and 100),
  created_at timestamptz not null default now(),
  unique (listing_id, from_user)
);
create index contact_requests_listing_idx on public.contact_requests (listing_id);
create index contact_requests_from_idx on public.contact_requests (from_user);

create or replace function public.limit_contact_requests()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.contact_requests
      where from_user = new.from_user and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Daily message limit reached (20 per day). Try again tomorrow.';
  end if;
  return new;
end $$;

create trigger contact_requests_limit
  before insert on public.contact_requests
  for each row execute function public.limit_contact_requests();

-- ============ Reports (readable only from the Supabase dashboard) ============
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reporter uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('spam','scam','inappropriate','other')),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  unique (listing_id, reporter)
);

-- ============ Row Level Security ============
alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.contact_requests enable row level security;
alter table public.reports enable row level security;

create policy "Anyone can read schools" on public.schools
  for select using (true);

create policy "Anyone can read profiles" on public.profiles
  for select using (true);
create policy "Users update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "Read active listings and own listings" on public.listings
  for select using (status = 'active' or user_id = auth.uid());
create policy "Users create own listings" on public.listings
  for insert to authenticated with check (user_id = auth.uid() and status = 'active');
create policy "Users update own listings" on public.listings
  for update to authenticated
  using (user_id = auth.uid() and status <> 'hidden')
  with check (user_id = auth.uid() and status in ('active','done'));
create policy "Users delete own listings" on public.listings
  for delete to authenticated using (user_id = auth.uid());

create policy "Read images of visible listings" on public.listing_images
  for select using (exists (select 1 from public.listings l where l.id = listing_id));
create policy "Owners add images" on public.listing_images
  for insert to authenticated
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid()));
create policy "Owners remove images" on public.listing_images
  for delete to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid()));

create policy "Sender or listing owner can read requests" on public.contact_requests
  for select to authenticated using (
    from_user = auth.uid()
    or exists (select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid())
  );
create policy "Send a request to someone else's active listing" on public.contact_requests
  for insert to authenticated with check (
    from_user = auth.uid()
    and exists (select 1 from public.listings l
                where l.id = listing_id and l.status = 'active' and l.user_id <> auth.uid())
  );
create policy "Sender can withdraw a request" on public.contact_requests
  for delete to authenticated using (from_user = auth.uid());

create policy "Signed-in users can report" on public.reports
  for insert to authenticated with check (reporter = auth.uid());

-- ============ Storage (photos: public read, owner-only write) ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 614400, array['image/jpeg'])
on conflict (id) do nothing;

create policy "Users upload to their own folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "Users delete their own images" on storage.objects
  for delete to authenticated using (
    bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text
  );
