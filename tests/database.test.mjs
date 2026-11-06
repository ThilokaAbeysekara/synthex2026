import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('PostgreSQL migration, duplicate rollback and organizer-only RLS', async () => {
  const db = new PGlite();
  try {
    // Real PostgreSQL engine; only Supabase-managed schema prerequisites are
    // fixtures. The migration and role/RLS tests run unchanged.
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      create schema storage;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid() primary key, bucket_id text references storage.buckets(id), name text, metadata jsonb);
      alter table storage.objects enable row level security;
      grant usage on schema public, auth, storage to anon, authenticated, service_role;
      grant select, insert, update, delete on storage.objects to anon, authenticated;
      -- Intentionally broad pre-existing policies: the new restrictive policies
      -- must still prevent reading or writing private papers.
      create policy existing_broad_read on storage.objects for select to public using(true);
      create policy existing_broad_insert on storage.objects for insert to public with check(true);
      create policy existing_broad_update on storage.objects for update to public using(true) with check(true);
      create policy existing_broad_delete on storage.objects for delete to public using(true);
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/202611070001_submission_portal.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/tests/portal-security.sql', import.meta.url), 'utf8'));
    const result = await db.query("select public,file_size_limit from storage.buckets where id = 'concept-papers'");
    assert.equal(result.rows[0].public, false);
    assert.equal(Number(result.rows[0].file_size_limit), 5242880);
    assert.equal((await db.query('select count(*)::int as count from public.research_submissions')).rows[0].count, 0);
  } finally { await db.close(); }
});
