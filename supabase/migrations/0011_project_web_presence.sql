-- Mindraft · 0011 project link and domain
alter table public.projects
  add column if not exists website_url text,
  add column if not exists domain text;

alter table public.projects
  drop constraint if exists projects_website_url_length,
  add constraint projects_website_url_length check (website_url is null or char_length(website_url) <= 2048),
  drop constraint if exists projects_domain_length,
  add constraint projects_domain_length check (domain is null or char_length(domain) <= 253);
