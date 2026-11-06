# SYNTHEX 2026 submission portal

The existing site is static HTML, CSS and browser JavaScript. Its public design, animations, navigation, individual/group fields, template downloads and confirmation receipt are preserved. Google submission endpoints and browser-local submission backups are no longer used. The legacy Apps Script file is retained as an archive of existing work and excluded from Vercel deployment; disable its old deployed webhook after cutover.

## Architecture and schema

The build generates `public-config.js` from environment variables, containing **only the public project URL and publishable key**. The existing submission page loads that static script and sends multipart form data directly to the Supabase `submit-research` Edge Function. It makes no `/api/config` request, so a static preview or an API access restriction cannot break JSON configuration parsing. This bypasses Vercel's 4.5 MB function request limit, allowing PDFs up to **5 MiB (5,242,880 bytes)**. Participants do not need an account.

The migration in [supabase/migrations/202611070001_submission_portal.sql](supabase/migrations/202611070001_submission_portal.sql) creates:

| Table | Purpose |
| --- | --- |
| `research_submissions` | Full UUID-based `SYNTHEX-?` ID, timestamp, submission type, batch, topic, normalized contact email, optional phone, private PDF path/name/size and unique retry token. |
| `submission_participants` | Ordered participants (first is lead), full names and normalized registration numbers. One participant for individual entries, 2?6 for groups. |
| `portal_admins` | Organizer allowlist linked to Supabase Auth user IDs. Only an owner with SQL/dashboard access can manage membership. This security allowlist is retained; the website has no organizer login interface. |
| `portal_settings` | Authoritative server-side submission open/closed switch. |
| `portal_request_limits` | Short-lived salted hashes of gateway IP addresses and atomic request counters. |

One entry is allowed per contact email and per participant registration number across all individual and group submissions. Database unique constraints enforce this under concurrent requests; frontend checks alone cannot. Email case and registration case/whitespace are normalized. This policy prevents ordinary duplicate entries; it does not prove identity or ownership of an unverified email. Organizer intervention is required for corrections.

The private `concept-papers` bucket permits only `application/pdf` and enforces the same 5 MiB size limit. No participant has direct database or Storage write permission. Only the Edge Function's service role writes. Authenticated organizers have read-only access; all other users are denied. Restrictive bucket policies also guard against broader pre-existing Storage policies. Review other existing application policies before applying to a shared project. Existing unknown tables are left untouched; legacy records are not automatically migrated.

## Deploy Supabase first

1. Create or select your own Supabase project. Back up any existing database. If `concept-papers` already exists, review its contents and existing access before migration: this migration makes it private.
2. Run the migration **once**, either through Supabase SQL Editor or through the Supabase CLI. It is transactional and is not intended to be pasted repeatedly. With the CLI installed:

   ```powershell
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

   Review `db push` output before proceeding, particularly in a project with existing migration history. SQL Editor users should execute the exact migration file instead of `db push`.

3. Configure Edge Function secrets in Supabase Dashboard > Edge Functions > Secrets:

   ```text
   ALLOWED_ORIGINS=https://synthex2026.live,https://www.synthex2026.live
   RATE_LIMIT_SALT=<a long randomly generated secret>
   ```

   Origins must match exactly, without trailing slashes. Add an exact Vercel Preview origin only when needed; preview origins are not automatically trusted. For local development add `http://localhost:3000`. Do not use `*`.

   Hosted Edge Functions provide `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically. The function requires the service role and never falls back to the anonymous key. Keep that secret **only in Supabase's server environment**. The rate-limit salt is also server-only.

4. Deploy the function from this repository root:

   ```powershell
   supabase functions deploy submit-research --project-ref YOUR_PROJECT_REF --no-verify-jwt
   ```

   The matching setting is in [supabase/config.toml](supabase/config.toml). Anonymous participants have no Auth JWT, and current publishable keys are not JWTs. Leaving gateway JWT verification enabled will block submissions. The function performs validation, exact-origin CORS checks, request-body limits and a database-backed budget of 20 attempts per 15-minute IP window. IP limits are an additional abuse control; shared university networks may need a higher budget configured in `claim_portal_request`. CORS does not authenticate clients, and public keys are not secrets.

## View submissions without adding a login page to the website

The public website has no participant or organizer login screen. Authorized organizers use the existing **Supabase Dashboard**: Table Editor > `research_submissions` and `submission_participants` to view entries, and Storage > `concept-papers` to download papers. Give organizers access through your Supabase organization's normal team access controls. The bucket remains private and the database RLS policies remain enabled. Do not make papers public to avoid signing in to the dashboard.

The original settings icon stays on the submission page and opens a small submission-information panel, rather than a login interface. The original page layout, form, styles and animations are preserved.

## Configure and deploy Vercel

In the existing Vercel project, keep the current domain and repository. Set Framework Preset to **Other**, use the repository root, use **`npm run build`** as the Build Command (also set in `vercel.json`) and leave Output Directory unset (or use the root `.` if required by the dashboard). The build writes public configuration into a static script. The submission page no longer depends on a runtime configuration API.

Set these variables in Vercel > Settings > Environment Variables for **Production** and any **Preview** environment you intend to use:

```text
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PROJECT_KEY
```

Use your actual project values from Supabase > Project Settings > API Keys. A legacy `anon` JWT key is also supported. **Never enter a service-role JWT or `sb_secret_?` key in the publishable-key variable.** Both the build and optional configuration API reject these secret key types. Do not add any service-role secret to Vercel; it is not needed there. [.env.example](.env.example) contains placeholders only.

Redeploy after environment-variable changes. No Supabase credentials are assumed or hardcoded. The build fails with a clear configuration error if values are missing or a secret key was supplied. The generated script is ignored by Git. Vercel adds no-store configuration responses, anti-framing and MIME-sniffing protection. Deployment exclusions prevent shipping backend maintenance scripts, migrations, tests or the retired Apps Script.

For local preview, copy `.env.example` to `.env` and fill in your own public values. Then run:

```powershell
npm run build
python -m http.server 8000
```

Open `http://localhost:8000/submit.html` and add that exact origin to the Edge Function's `ALLOWED_ORIGINS`. The build loads `.env` with Node's built-in environment-file support. Only its URL and public key are written to the generated script; secrets are never serialized. You can also use `vercel dev`. Do not preview the submission API through a `file://` URL. A preview that blocks network access must be opened in a regular browser or hosted on Vercel.

If the service returns plain text such as `Forbidden.` or an HTML gateway error, the form now checks the response safely and shows a readable error while keeping all entered data. An actual Supabase denial still requires checking the deployed function, `--no-verify-jwt` setting, and allowed origin; a denied request is never treated as a successful submission.

<<<<<<< HEAD
### Method 1: Dedicated Google Apps Script Webhook (Recommended & Reliable)
This is the **most robust** method. It bypasses all Google Form login barriers, allows submissions from anyone without signing in, and **automatically uploads the Concept Paper (PDF/DOCX) into Google Drive** with a clickable link in your Google Sheet!

1. Create a new Google Spreadsheet at [sheets.new](https://sheets.new) (or open your existing spreadsheet).
2. Go to **Extensions** > **Apps Script**.
3. Replace the code in the editor with the contents of [`google-apps-script.js`](google-apps-script.js).
4. Click **Deploy** > **New deployment**.
5. Select **Web app** (via the gear icon next to "Select type").
6. Set:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone** (⚠️ **Crucial**: Must be "Anyone", NOT "Only myself")
7. Click **Deploy**, authorize permissions if prompted (Advanced -> Go to unsafe -> Allow).
8. Copy the generated Web App URL (starts with `https://script.google.com/macros/s/.../exec`).
9. On your SYNTHEX website, click the **Settings (Gear icon)** in the top navigation bar, paste your Web App URL, and click **Save Settings** (or paste it into `CONFIG.appsScriptUrl` in `app.js`).

---

### Method 2: Why Direct Google Form Submissions Often Fail
If you submit directly to Google Form endpoints from external websites:
1. **Google Sign-in Requirement**: If the Google Form has "Limit to 1 response", "Restrict to users in [University] domain", or "Collect email addresses: Verified" enabled, Google blocks external POST requests with `HTTP 401 Unauthorized` and redirects to the Google Account login page.
2. **File Upload Restrictions**: Google Forms NEVER permits anonymous or external submissions if the form has a "File Upload" question, because Google requires respondent authentication for Drive storage.
3. **Fixing Google Form Direct Submission (Text Only)**:
   - Open your form at [Google Forms Edit](https://docs.google.com/forms/d/17yshc-_WReK7hkJFw-Rja6fRgYTfuDDETcJBow-sPzI/edit).
   - Go to **Settings > Responses**:
     - Turn OFF **"Restrict to users in [Organization]"**
     - Turn OFF **"Limit to 1 response"**
     - Set **"Collect email addresses"** to **"Do not collect"**
   - Note: File attachments cannot be transferred to Google Form via external POST; use Method 1 (Apps Script) for file uploads to Google Drive.
=======
## Failure handling and operations

PDF validation checks required attachment, filename, declared MIME type, nonempty size, 5 MiB limit and `%PDF-x.y` header in both browser and Edge Function. This detects common accidental uploads and renamed documents; it is not a full PDF parser or malware scanner. Papers are managed through the existing Supabase Dashboard; no PDF viewer or login screen is added to the website.
>>>>>>> 5ee7a66 (updated)

The function uploads an object with a random path, then calls a service-only PostgreSQL function. The function verifies the object metadata exists and commits the submission and all participant claims in one transaction. Failed transactions leave no incomplete submission records. Rejected uploads/transactions return errors; the browser preserves the form and does not celebrate a failure.

A retry token is retained in page memory for the same normalized payload and file hash. Retrying after a lost response returns the original ID. Keep the page open after an ambiguous network error; reloading loses that token, but database uniqueness still prevents a second submission. Distinct concurrent attempts own separate objects, so cleanup cannot delete another attempt's committed paper.

Storage and PostgreSQL cannot share a distributed transaction. The function retries object cleanup three times on known failures. If the database response is uncertain it checks the committed row before removing anything. A process crash or persistent Storage outage can leave an **unreferenced private object**, never an organizer-visible incomplete submission. Review Edge Function logs and run [scripts/cleanup-orphan-papers.mjs](scripts/cleanup-orphan-papers.mjs) periodically from a trusted maintenance machine. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in that process's environment only, then:

```powershell
node scripts/cleanup-orphan-papers.mjs
# Inspect the dry-run list first; this deletes only unreferenced objects older than 24 hours:
node scripts/cleanup-orphan-papers.mjs --apply
```

The script fails closed on request errors and rechecks references before each removal. Do not delete objects directly with SQL because that bypasses Storage's object lifecycle. Back up database and Storage according to your retention requirements.

To close submissions, use the authoritative database switch:

```sql
update public.portal_settings set submissions_open = false where singleton;
```

Also set `CONFIG.submissionsOpen` to false in [app.js](app.js) and redeploy to display the existing closed-state UX. URL preview flags affect appearance only and cannot override the server setting. Set both switches true to reopen.

## Verification

```powershell
npm ci
npm test
npm run check
```

Tests cover validation, 5 MiB boundaries, successful individual/group submissions, concurrent retries, duplicate participant/email claims, upload/database failures, ambiguous commits, cleanup retries, rate limiting, CORS and rejecting secret keys in public configuration. Backend-boundary tests simulate Supabase responses. PostgreSQL tests execute the real migration and RLS checks in PGlite against minimal Auth/Storage schema fixtures; they do not emulate Supabase's Storage HTTP service or JWT gateway.

Run [supabase/tests/portal-security.sql](supabase/tests/portal-security.sql) in an **isolated Supabase test project** after the migration as well. It rolls back its fixtures and verifies actual role privileges, organizer-only rows/files, no self-promotion, duplicate constraints, idempotency and transactional rollback. Use a test project so concurrent real submissions cannot interfere.

Before production cutover, test the actual deployment:

- Submit individual and group entries with real valid PDFs; save the confirmed IDs and verify the PDFs and participant rows in the Supabase Dashboard.
- Accept a PDF at the exact size limit; reject one byte over, renamed text, DOCX, empty file, missing required fields and repeated group registrations.
- Repeat an email and a participant registration with a different email; confirm rejection and no extra committed paper.
- Interrupt the network after sending, then retry the unchanged form in the same page; confirm the same ID and one entry.
- Confirm logged-out and non-organizer accounts cannot query submissions or read PDFs through REST/Storage, and public object URLs fail. Confirm authorized organizers can download through the Supabase Dashboard.
- Close submissions in SQL and verify direct requests are rejected even with `?open=1`.
- Confirm the Vercel Production origin and any explicitly allowed Preview origin work. Inspect both Vercel and Supabase logs for configuration, JWT, RLS and Storage errors.

Implementation can be tested locally without credentials; a live end-to-end Supabase/Storage/Vercel test requires your configured project, applied SQL, deployed function and authorized dashboard access. No production deployment or database changes are performed merely by editing this repository.
