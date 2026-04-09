-- Profile accent (Discord-style banner trim / theme color)
alter table public.profiles
  add column if not exists accent_color text;

comment on column public.profiles.accent_color is 'Hex color e.g. #5865F2 for profile accent when no banner image';
