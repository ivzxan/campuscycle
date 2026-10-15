-- CampusCycle database schema (unified: profiles, listings, contact requests, in-app chat, notifications).

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
  bio text not null default '' check (char_length(bio) <= 200),
  avatar_color text not null default 'indigo'
    check (avatar_color in ('indigo','teal','green','amber','rose','violet','slate','sky')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, school_id, display_name, program, affiliation, avatar_color)
  values (
    new.id,
    (select id from public.schools order by name limit 1),
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1)), 40),
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'program'), ''), 'BSIS'), 30),
    case when new.raw_user_meta_data->>'affiliation' in ('student','graduating','alumni')
         then new.raw_user_meta_data->>'affiliation' else 'student' end,
    (array['indigo','teal','green','amber','rose','violet','slate','sky'])[1 + floor(random() * 8)::int]
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

-- ============ Contact requests (kept from v1; safe to drop if unused) ============
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

-- ============ Conversations (one per listing per person who reaches out) ============
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  starter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  last_message text not null default '',
  last_sender uuid,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (listing_id, starter_id)
);
create index conversations_starter_idx on public.conversations (starter_id, last_message_at desc);
create index conversations_owner_idx on public.conversations (owner_id, last_message_at desc);

create or replace function public.before_conversation_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare l record;
begin
  select user_id, status into l from public.listings where id = new.listing_id;
  if l.user_id is null then raise exception 'Listing not found.'; end if;
  if l.status <> 'active' then raise exception 'This listing is no longer available.'; end if;
  if l.user_id = new.starter_id then raise exception 'You cannot message yourself.'; end if;
  if (select count(*) from public.conversations
      where starter_id = new.starter_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Daily limit for starting new chats reached. Try again tomorrow.';
  end if;
  new.owner_id := l.user_id;
  return new;
end $$;

create trigger conversations_before_insert
  before insert on public.conversations
  for each row execute function public.before_conversation_insert();

-- ============ Messages ============
create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_conv_idx on public.messages (conversation_id, id desc);
create index messages_unread_idx on public.messages (conversation_id) where read_at is null;

create or replace function public.before_message_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.messages
      where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'You are sending messages too fast. Wait a moment.';
  end if;
  return new;
end $$;

create trigger messages_before_insert
  before insert on public.messages
  for each row execute function public.before_message_insert();

-- ============ Notifications ============
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('message','listing_done')),
  title text not null,
  context text,
  body text,
  link text not null,
  conversation_id uuid references public.conversations(id) on delete cascade,
  count int not null default 1,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- A new message updates the recipient's alert (or creates one); updates keep the inbox from flooding.
create or replace function public.on_message_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare c record; recipient uuid; sender_name text; ltitle text; preview text;
begin
  select * into c from public.conversations where id = new.conversation_id;
  recipient := case when new.sender_id = c.starter_id then c.owner_id else c.starter_id end;
  preview := left(new.body, 80);

  update public.conversations
     set last_message = preview, last_sender = new.sender_id, last_message_at = new.created_at
   where id = c.id;

  select display_name into sender_name from public.profiles where id = new.sender_id;
  select title into ltitle from public.listings where id = c.listing_id;

  update public.notifications
     set count = count + 1, body = preview, created_at = now()
   where user_id = recipient and conversation_id = c.id and type = 'message' and read_at is null;

  if not found then
    insert into public.notifications (user_id, type, title, context, body, link, conversation_id)
    values (recipient, 'message', sender_name, ltitle, preview, '/messages/' || c.id, c.id);
  end if;
  return new;
end $$;

create trigger messages_after_insert
  after insert on public.messages
  for each row execute function public.on_message_insert();

-- Tell people who messaged about a listing when it is marked done.
create or replace function public.on_listing_done()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'active' and new.status = 'done' then
    insert into public.notifications (user_id, type, title, context, body, link)
    select distinct c.starter_id, 'listing_done', 'No longer available', new.title,
           'The poster marked this listing as done.', '/listing/' || new.id
      from public.conversations c where c.listing_id = new.id;
  end if;
  return new;
end $$;

create trigger listings_status_done
  after update of status on public.listings
  for each row execute function public.on_listing_done();

-- Opening a chat marks the other person's messages (and its alert) as read.
create or replace function public.mark_conversation_read(conv uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.conversations
                  where id = conv and (starter_id = auth.uid() or owner_id = auth.uid())) then
    return;
  end if;
  update public.messages set read_at = now()
   where conversation_id = conv and sender_id <> auth.uid() and read_at is null;
  update public.notifications set read_at = now()
   where user_id = auth.uid() and conversation_id = conv and read_at is null;
end $$;
revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

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
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;

create policy "Anyone can read schools" on public.schools
  for select using (true);

create policy "Anyone can read profiles" on public.profiles
  for select using (true);
create policy "Users update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Done listings stay readable so chats and profiles can still link to them.
create policy "Read active, done, and own listings" on public.listings
  for select using (status in ('active','done') or user_id = auth.uid());
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

create policy "Participants read conversations" on public.conversations
  for select to authenticated using (starter_id = auth.uid() or owner_id = auth.uid());
create policy "Start a conversation as yourself" on public.conversations
  for insert to authenticated with check (starter_id = auth.uid());

create policy "Participants read messages" on public.messages
  for select to authenticated using (exists (
    select 1 from public.conversations c
     where c.id = conversation_id and (c.starter_id = auth.uid() or c.owner_id = auth.uid())));
create policy "Participants send messages" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid() and exists (
      select 1 from public.conversations c
       where c.id = conversation_id and (c.starter_id = auth.uid() or c.owner_id = auth.uid())));

create policy "Read own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "Update own notifications" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Delete own notifications" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

create policy "Signed-in users can report" on public.reports
  for insert to authenticated with check (reporter = auth.uid());

-- ============ Realtime (live chat and alerts; still filtered by the policies above) ============
-- Guarded so this file can be re-run without "already member of publication" errors.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime
      add table public.messages, public.notifications, public.conversations;
  end if;
end $$;

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