# SYNTHEX 2026: Vercel registration + Supabase + Google Sheets

The existing website is preserved. There is no new website, participant account, Google sign-in, Turnstile, or organizer login screen.

Participants visit `index.html` and `submit.html` on the same Vercel domain. Every registration CTA (including About and the clickable bulb) opens local `submit.html`. Browser submissions go directly to Supabase Cloud. Google Apps Script receives only server-to-server synchronization requests; it never serves the registration UI. No CSS or JavaScript attempts to hide Google's banner.

## Files changed

| Files | Change |
| --- | --- |
| [index.html](index.html), [about.html](about.html) | Replaced Apps Script registration links with `submit.html`; all other layout and styling retained. |
| [submit.html](submit.html), [app.js](app.js) | Resolved committed merge-conflict markers, removed direct Google Forms/Apps Script and browser-local success fallbacks, preserved the original form/modals/confetti, restored 10 MB PDF/DOC/DOCX uploads, added Sheets sync status to confirmed receipts. |
| [submission-validation.mjs](submission-validation.mjs) | Shared browser/server validation: individual or 2-6 members, existing batches, email, optional phone, duplicate registrations, file extension/MIME/signature/size checks. |
| [vercel.json](vercel.json) | Runs `npm run build` and serves the existing root (`.`). Existing security headers and protected backend routes remain. |
| [supabase/functions/submit-research/](supabase/functions/submit-research/) | Validates and stores documents privately, finalizes registrations transactionally, then attempts Sheets synchronization. |
| [supabase/functions/_shared/sheets-sync.mjs](supabase/functions/_shared/sheets-sync.mjs), [supabase/functions/sync-sheets/](supabase/functions/sync-sheets/) | Secret-protected, durable, idempotent synchronization and retry worker. |
| [supabase/migrations/202611070002_registration_sheets_bridge.sql](supabase/migrations/202611070002_registration_sheets_bridge.sql) | Preserves existing records while renaming the earlier table to `synthex_submissions`, increases limits to 10 MB, permits all three document types, and adds a private transactional synchronization queue. |
| [google-apps-script.js](google-apps-script.js) | Server-only bridge for the existing spreadsheet. Verifies a shared secret, locks duplicate checking and appending, deduplicates by reference ID, and neutralizes spreadsheet formulas. |
| [supabase/setup-sync-schedule.sql](supabase/setup-sync-schedule.sql), [scripts/cleanup-orphan-papers.mjs](scripts/cleanup-orphan-papers.mjs) | Hosted retry schedule and updated private-document maintenance. |
| [tests/](tests/), [supabase/tests/](supabase/tests/) | Regression coverage for local links/assets, actual PostgreSQL migration/RLS/queue semantics, document formats, failures and the bridge. |

The existing [styles.css](styles.css), fonts, images, guideline PDF and Word template were not changed. Existing `package.json` already defines the correct build script; Vercel now actually executes it. The generated public configuration mechanism in [scripts/build-config.cjs](scripts/build-config.cjs), [public-config.cjs](public-config.cjs), and [supabase-client.js](supabase-client.js) remains in use. No project credentials have been invented or hardcoded.

## Registration and privacy

1. The Vercel build generates `public-config.js` containing only the public Supabase URL and publishable key. This generated file is ignored by Git. The form does not depend on a runtime `/api/config` request.
2. `app.js` sends multipart data to `${SUPABASE_URL}/functions/v1/submit-research`. Documents go directly to Supabase, avoiding Vercel's function request-size limit.
3. The Edge Function applies server-side rate limiting, required field/member checks, canonicalizes email/registration numbers, and validates the document before uploading it to private `concept-papers` Storage.
4. A service-only database function verifies the object metadata and atomically commits `synthex_submissions`, `submission_participants`, and one `sheet_sync_jobs` entry. Unique email and participant-registration constraints prevent duplicate entries, including concurrent requests.
5. Only then does the API return a database-generated full UUID reference (`SYNTHEX-...`). The success modal appears only after confirmation. A retry token recovers the original ID after a lost response; keep the page open when retrying an ambiguous result.
6. Supabase attempts the Sheets webhook using a server-only secret. If confirmed, the response contains `syncStatus: "synced"`. Otherwise it returns `syncStatus: "pending"`, and the receipt explicitly states that the registration was saved and must not be resubmitted.
7. A scheduled server-only worker retries queue entries with leases and exponential backoff. Google Sheets checks column B for the reference ID under a script lock, preventing duplicate rows even if a webhook response is lost.

The 10 MB limit is **10 MiB / 10,485,760 bytes**, consistently enforced by browser, Edge Function, Storage, and database. PDF headers, DOC compound-file headers/Word markers, and DOCX ZIP directories/Word parts are checked. Renamed unsupported documents and DOCX archives expanding beyond 50 MiB are rejected. These checks identify document types; they are not a malware scanner or a complete Office/PDF parser.

Storage remains private. There are no public file URLs or permanent signed links in Sheets. The spreadsheet stores the private object path in its existing concept-paper column. Authorized organizers view `synthex_submissions` and participants in the Supabase Dashboard, and download through Storage > `concept-papers` using their normal organization permissions. No login interface is added to the public site. Existing organizer allowlist/RLS protections remain enabled for any existing authenticated integrations. Anonymous clients cannot directly read or write tables, the queue, or private objects.

Server-side rate limiting allows 20 attempts per 15-minute hashed gateway-IP window. It fails closed if its database check fails. University networks sharing one IP may require an adjusted budget in `claim_portal_request`. CORS is an additional browser restriction, not authentication or a replacement for rate limiting.

## 1. Configure Vercel

Use the **existing Vercel project**, domain and repository. Framework Preset: **Other**. Root Directory: repository root. Build Command: **`npm run build`**. Output Directory: **`.`**. These match the root-level HTML structure and are explicitly set in [vercel.json](vercel.json); do not configure `dist` or `public`.

Set these existing variables in Vercel Settings > Environment Variables for Production and any intended Preview environment:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Your actual `https://YOUR_PROJECT_REF.supabase.co` URL. |
| `SUPABASE_PUBLISHABLE_KEY` | Your project's `sb_publishable_...` key or legacy `anon` JWT. |

Do not put service-role keys, `sb_secret_...` keys, Sheets secrets, worker tokens or spreadsheet IDs in frontend configuration. The build refuses secret key types in the publishable-key field. [.env.example](.env.example) contains placeholders only. Redeploy after environment changes.

The build loads a local `.env` when present. A plain static server works **after** the build has generated public config. For local development:

```powershell
# Copy .env.example to .env and fill in only your public project values first.
npm ci
npm run build
python -m http.server 8000
```

Open `http://localhost:8000/`. Add this exact origin to the Supabase allowlist when testing real submissions. Backend sources, tests, maintenance scripts and Apps Script are excluded from Vercel upload or protected by existing routes. Assets and root-level `app.js`, `styles.css`, `submission-validation.mjs`, images, `Guideline.pdf`, and `Research_Concept_Paper.docx` remain available.

## 2. Apply Supabase database changes

Back up existing data and confirm your Supabase project before applying schema changes.

- New setup: apply [202611070001_submission_portal.sql](supabase/migrations/202611070001_submission_portal.sql), then [202611070002_registration_sheets_bridge.sql](supabase/migrations/202611070002_registration_sheets_bridge.sql).
- If the first migration is already applied: apply **only the second**. Do not rerun the first migration.
- The second migration renames `research_submissions` to `synthex_submissions`, preserving data, IDs, foreign keys and RLS. If both names already exist, it stops without deleting either table; reconcile the unknown existing schema before continuing.

Use SQL Editor in the above order or, with the Supabase CLI installed and matching migration history:

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Review the linked project and migration output. The resulting table stores type, batch, project topic, normalized email, optional phone, document path/name/size/MIME, request token and timestamp. Participants are ordered in `submission_participants`. `sheet_sync_jobs` is service-role-only and tracks status, attempts, next retry, lease, and confirmation time. Queue creation is part of the same transaction as registration.

## 3. Update the existing Google Apps Script bridge

Replace the code in the **existing Apps Script project** with [google-apps-script.js](google-apps-script.js). Keep the existing spreadsheet and its data. In Apps Script > Project Settings > Script Properties set:

| Property | Value |
| --- | --- |
| `SHEETS_SYNC_SECRET` | A long random secret; identical to the Supabase secret below. |
| `SPREADSHEET_ID` | The ID of your existing Google Spreadsheet. |
| `SHEET_NAME` | Optional existing tab name; if unset the first tab is used. Set it when existing responses are not in the first tab. |

The existing spreadsheet layout is retained: reference IDs are in **column B** and the bridge appends the same ten columns. The concept-paper column now holds a private Supabase path rather than a public Drive URL. If your spreadsheet has a different column order, adapt it before switching the bridge.

Deploy > Manage deployments > Edit the existing Web App deployment > select a **new version** > Deploy. Execute as the owner, access **Anyone** so the Supabase server can call it; every POST still requires the shared secret. Copy the `/exec` URL to the server-only Supabase secret. Using a deployment URL that requires a Google user login will keep jobs pending.

`doGet` serves only a JSON message. There is no registration page, no Drive copy, no public sharing and no direct browser-to-Apps-Script call. Google's Apps Script banner is avoided because participants never visit that host.

## 4. Configure and deploy Supabase Edge Functions

Set these secrets through Supabase Dashboard > Edge Functions > Secrets:

| Secret | Value |
| --- | --- |
| `ALLOWED_ORIGINS` | `https://synthex2026.live,https://www.synthex2026.live` plus exact Preview/local origins you use, no trailing slashes or `*`. The legacy `ALLOWED_ORIGIN` name is also supported. |
| `RATE_LIMIT_SALT` | A long random value for hashing IP rate-limit keys. |
| `SHEETS_WEBHOOK_URL` | Existing Apps Script `/exec` URL. Existing `GOOGLE_SHEET_WEBHOOK_URL` or `APPS_SCRIPT_URL` aliases are also supported. |
| `SHEETS_SYNC_SECRET` | Exactly matches the Apps Script property. |
| `SYNC_WORKER_SECRET` | A separate long random value authenticating the retry worker. |

Hosted Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically. Only the Edge Functions use the service role. Never configure it in Vercel or client JavaScript.

From the repository root, deploy **both** functions:

```powershell
supabase functions deploy submit-research --project-ref YOUR_PROJECT_REF --no-verify-jwt
supabase functions deploy sync-sheets --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

The same JWT settings are in [supabase/config.toml](supabase/config.toml). Participants have no Auth JWT; modern publishable keys are not JWTs. The retry worker instead verifies `x-sync-worker-secret`. It is not a public administrative endpoint and must never be called from browser code.

## 5. Enable automatic Sheets retries

Enable Supabase Cron (`pg_cron`) and `pg_net` in the Dashboard. In **Vault**, create:

- `synthex_project_url`: your actual Supabase project URL, without a trailing slash.
- `synthex_sync_worker_secret`: the same value as Edge secret `SYNC_WORKER_SECRET`.

Run [supabase/setup-sync-schedule.sql](supabase/setup-sync-schedule.sql) in hosted SQL Editor. It schedules the worker every minute and resolves secrets from Vault at execution time. The worker processes at most ten due jobs per call; a failed call's lease expires after two minutes and is recoverable. Monitor the queue and increase worker frequency/capacity if traffic outgrows this batch size.

This follows Supabase's documented [Cron + pg_net + Vault scheduling approach](https://supabase.com/docs/guides/functions/schedule-functions). The schedule file is intentionally separate from the portable migrations because it requires hosted extensions and configured Vault values. Until configured, immediate synchronization is attempted but unattended retries cannot run.

## Operations

To close registrations authoritatively:

```sql
update public.portal_settings set submissions_open = false where singleton;
```

Also set `CONFIG.submissionsOpen` false in [app.js](app.js) and redeploy to show the original closed-state UI. URL preview switches affect appearance only and cannot override database closure.

Storage and PostgreSQL cannot share a distributed transaction. Failed finalization rolls back the registration, participants, and sync job, and the Edge Function retries removal of its own uploaded object. An interrupted process can leave an unreferenced **private** object, not a confirmed incomplete registration. [scripts/cleanup-orphan-papers.mjs](scripts/cleanup-orphan-papers.mjs) identifies objects older than 24 hours with no database reference. Run it on a trusted maintenance machine with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in that process's environment, inspect its dry run, then optionally apply:

```powershell
node scripts/cleanup-orphan-papers.mjs
node scripts/cleanup-orphan-papers.mjs --apply
```

The cleanup tool rechecks references before deleting and stops on request errors. Never delete Storage rows with SQL.

Queue monitoring (Dashboard SQL Editor):

```sql
select s.id, s.created_at, j.status, j.attempts, j.available_at, j.synced_at
from public.synthex_submissions s
join public.sheet_sync_jobs j on j.submission_id = s.id
order by s.created_at desc;
```

For a due job stuck pending, check the bridge URL/deployment access, matching secrets, tab name and worker Cron logs. Only a matching `{ "success": true, "id": "SYNTHEX-..." }` webhook acknowledgment marks the job synced. HTML sign-in pages, false acknowledgments and lost responses remain retryable. The public form safely handles plain-text `Forbidden.` and HTML gateway errors without reporting false success.

## Tests and local verification

```powershell
npm ci
npm test
npm run check
```

Automated tests run actual PostgreSQL migrations/RLS/queue SQL in PGlite with minimal Supabase-managed schema fixtures; registration SDK boundaries, Apps Script services and external HTTP calls are simulated. The bridge tests verify secret rejection, duplicate reference IDs, and spreadsheet formula protection. Signature tests cover PDF/DOC/DOCX, 10 MiB boundaries, and rejected renamed files. Registration tests cover all group sizes 2-6, field errors, races, rate limits, rollback and interrupted responses. Site tests cover local registration links, resources, merge markers and build configuration.

For hosted database verification, run [supabase/tests/portal-security.sql](supabase/tests/portal-security.sql) and [supabase/tests/sync-queue.sql](supabase/tests/sync-queue.sql) in an isolated test project's SQL Editor after both migrations. Fixtures roll back. This checks real Supabase roles and queue transactions without contacting Sheets.

Local browser checks performed for this change: homepage CTA remains on the local host; individual PDF and six-member DOCX form flows display the returned reference IDs; the real downloadable Word template passes client validation; pending/synced receipt messages display correctly; mobile-width home/form layouts have no document overflow. Those form responses were mocked, not live cloud submissions.

**No live Vercel deployment, Supabase Storage/database write, Google Sheets append or Cron run has been verified in this session.** These require the project's configured secrets, database migrations, deployed functions, bridge update and hosting deployment. Do not treat local tests as proof of production integration.

## Verify the live deployment

After completing the setup and Vercel deployment:

1. Open `https://synthex2026.live/` and the About page on desktop and mobile. Check colors, fonts, animations, logos, navigation and footer. Click every registration CTA and bulb: the address must remain on your Vercel domain at `submit.html`, with no Apps Script page/banner.
2. Open guidelines and download the Word template. In browser Network, confirm HTML/CSS/JS/images/fonts/documents load successfully; no browser request should go to Apps Script or Google Forms. Google Fonts requests remain intentional.
3. Submit a valid individual entry and a 2-6 member group. Test real PDF, DOC and DOCX documents, including the exact size limit and one byte over. Confirm missing fields, invalid email, repeated member registration, unsupported files and oversize documents produce clear errors.
4. Verify each receipt's reference ID exists in `synthex_submissions`, all members exist in `submission_participants`, and the correct file exists in the private `concept-papers` bucket. Confirm public/anonymous object reads fail.
5. Find the same reference ID once in the existing Google Sheet, then check `sheet_sync_jobs.status = 'synced'`. If pending, wait for the scheduled worker and inspect its logs. Do not re-enter the registration to trigger a retry.
6. Temporarily use a wrong bridge secret in a test environment: registration must still succeed with a pending-sync notice. Correct it, allow the job to become due, and verify Cron synchronizes it once. Repeated delivery of the same reference must not append duplicate rows.
7. Repeat an email/registration and simulate an interrupted upload or database response in a test environment. Verify no extra confirmed records, no false success and safe retry with the same page/token.
8. Confirm SQL closure rejects direct submissions even with `?open=1`, and restore the setting after testing.

## Exact Git commands for this checkout

This checkout is already paused in an interactive rebase of `main`, editing a commit. The remaining rebase item is an empty Vercel-trigger commit. The implementation did not alter Git history or push anything. To commit these fixes without amending/replacing the current commit message, finish that existing rebase, and attempt a normal push:

```powershell
git add --all
git commit -m "fix: keep registration on Vercel and sync confirmed entries to Sheets"
git -c core.editor=true rebase --continue
git status
git push origin main
```

If `rebase --continue` reports another conflict or an empty-commit decision, resolve that before pushing. A normal push may be rejected if the existing rebase rewrote already-published commits. Fetch and review the divergence before deciding how to update the shared branch; do not blindly force-push. Once a normal push is accepted, check the existing Vercel project's deployment logs: `npm run build` must complete and produce root `public-config.js` from your public environment values.
