# QHR server deployment

Live host: `3.78.219.190` (also `ec2-3-78-219-190.eu-central-1.compute.amazonaws.com`),
Ubuntu 24.04 on EC2.

**This host is shared with other projects.** QHR owns the `/qhr/` prefix and nothing
else — see `HOST-CONVENTIONS.md` before deploying anything else here.

Everything lives under `/home/ubuntu/apps/qhr-attendance`. PM2 processes are prefixed
`qhr-` and nginx routes come from a single project file, so other projects are
unaffected.

## URLs

| URL | Serves | Upstream |
|---|---|---|
| http://3.78.219.190/qhr | Marketing site | Next.js 127.0.0.1:3002 (`basePath=/qhr`) |
| http://3.78.219.190/qhr/register | Company registration wizard | same Next.js app |
| http://3.78.219.190/qhr/demo | Demo request | same Next.js app |
| http://3.78.219.190/qhr/contact | Contact form | same Next.js app |
| http://3.78.219.190/qhr/admin | Administration console | Next.js 127.0.0.1:3003 (`basePath=/qhr/admin`) |
| http://3.78.219.190/qhr/app | Employee web portal | static Expo export (`baseUrl=/qhr/app`) |
| http://3.78.219.190/qhr/api/v1 | Backend API | Express 127.0.0.1:5001 (prefix stripped) |
| http://3.78.219.190/qhr/health | Health probe | Express 127.0.0.1:5001 |
| http://3.78.219.190/ | Neutral project index | static, owned by no project |

Only port 80 is public. All app processes bind to `127.0.0.1` and are reachable
exclusively through nginx. Front ends call the API with the **relative** base
`/qhr/api/v1`, so the same build works on the IP, the DNS name, or a future domain.

## Files installed on the server

- `ecosystem.server.config.js` — PM2 process definitions
- `redeploy.sh` — unpack a code drop, rebuild, restart, verify
- `verify.sh` / `verify-onboarding.sh` / `verify-public-pages.sh` / `verify-admin-design.sh` /
  `verify-migration.sh` / `verify-calendar-and-plans.sh` / `verify-employee-lifecycle.sh` /
  `verify-notifications.sh` / `verify-locations-and-guidance.sh` / `verify-admin-bundle.sh` —
  post-deploy smoke checks
- `check-sample-residue.sh` — guard against demo-tagged records in tenant data
- `/etc/nginx/sites-available/00-shared-host` — shared, project-neutral entry point
- `/etc/nginx/projects.d/qhr-attendance.conf` — this project's routes only
- `attendance-mobile/Backend/.env` — production settings (origins, TTLs, rate limits)
- `attendance-mobile/Backend/data/db.json` — JSON database (seeded on first boot)
- `logs/` — PM2 stdout/stderr per app

## Operations

```bash
ssh -i ~/.ssh/qwegle.pem ubuntu@ec2-3-78-219-190.eu-central-1.compute.amazonaws.com

pm2 list                       # process status
pm2 logs qhr-backend --lines 100
pm2 restart qhr-backend        # or qhr-admin / qhr-landing
./verify.sh                    # smoke check all routes and auth
./verify-onboarding.sh         # read-only check of the company setup wizard API
./verify-public-pages.sh       # read-only check of /register, /demo, /contact
./verify-admin-design.sh       # admin shell, design tokens, no pre-filled creds
./verify-migration.sh          # import template, dry run writes nothing, RBAC
./verify-calendar-and-plans.sh # seat model, plan catalogue, company calendar
./verify-employee-lifecycle.sh # onboarding prefill, org masters, employee create
./verify-notifications.sh      # birthday wishes, dedupe, read state, anniversary
./verify-locations-and-guidance.sh  # geofence-to-site backfill, geofence editing, guidance
./verify-admin-bundle.sh       # the admin UI strings really are in the served bundle
./check-sample-residue.sh      # guard: no demo-tagged records left in any tenant
sudo nginx -t && sudo systemctl reload nginx
```

PM2 and nginx are enabled at boot (`pm2-ubuntu.service`).

## Redeploying after code changes

From the workspace root:

```powershell
tar --exclude-vcs -czf "$env:TEMP\qhr-deploy.tar.gz" --exclude=node_modules --exclude=.next `
  --exclude=dist --exclude=.expo --exclude=*.log --exclude=attendance-mobile/Backend/data `
  admin-panel landing-page attendance-mobile
scp -i "$env:USERPROFILE\.ssh\qwegle.pem" "$env:TEMP\qhr-deploy.tar.gz" `
  ubuntu@ec2-3-78-219-190.eu-central-1.compute.amazonaws.com:/home/ubuntu/apps/qhr-attendance/
```

Then on the server, run the one-shot redeploy (extracts, installs deps only when a
`package.json` changed, rebuilds under `/qhr`, recreates the `qhr-*` PM2 apps,
reloads nginx, and verifies):

```bash
cd /home/ubuntu/apps/qhr-attendance
./redeploy.sh
```

`redeploy.sh` lives in `deploy/` in the repo and is copied to the app root on the
server. The equivalent manual sequence is:

```bash
tar -xzf qhr-deploy.tar.gz && rm qhr-deploy.tar.gz
cd attendance-mobile/Backend && npm ci --omit=dev && cd ../..
cd admin-panel && npm ci && cd ..
cd landing-page && npm ci && cd ..
cd attendance-mobile && npm ci && cd ..
./install-multi-project.sh    # rebuilds under /qhr, recreates pm2 apps, reloads nginx
./verify.sh http://127.0.0.1/qhr
```

`install-multi-project.sh` is idempotent and only touches this project's build
output, its own nginx route file, the shared host file, and `qhr-*` PM2 apps.

**The JSON store caches all data in memory.** Stop `qhr-backend` before editing
`data/db.json` by hand, or the running process will overwrite your change.

## Outstanding risks

1. **No HTTPS.** Traffic, logins and payroll data travel in clear text. Point a
   domain at this host and run `sudo certbot --nginx` before real use.
2. **Seeded demo accounts still exist in the database** (`company@example.com` /
   `password123`, `admin@qhr.com` / `admin123`, employee passcode `1234`). They are
   no longer pre-filled on the sign-in form, but the accounts remain valid — change
   or remove them. `verify-admin-design.sh` guards against the pre-fill returning.
3. **JSON file storage** — single process, no transactions, no backups. Migrate to
   a database and schedule backups before onboarding real employees.
4. No monitoring, alerting or log rotation beyond PM2 defaults.
