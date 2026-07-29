# Shared host conventions — 3.78.219.190

This EC2 box hosts **multiple independent projects** behind one nginx on port 80.
Follow these rules and projects can be added, updated, or removed without ever
breaking each other.

## The three rules

1. **One path prefix per project.** A project owns `/<prefix>/` and nothing else.
   QHR owns `/qhr/`. The site root `/` belongs to no project.
2. **One nginx file per project.** Drop `location` blocks only into
   `/etc/nginx/projects.d/<project>.conf`. Never edit another project's file, and
   never edit `/etc/nginx/sites-available/00-shared-host`.
3. **One localhost port block per project.** Apps bind to `127.0.0.1` only and are
   reached exclusively through nginx. Claim ports in the registry below.

## Layout on the server

```
/etc/nginx/sites-enabled/00-shared-host      # shared, project-neutral entry point
/etc/nginx/projects.d/qhr-attendance.conf    # QHR routes only
/etc/nginx/projects.d/<next-project>.conf    # add new projects here
/var/www/shared-host/index.html              # neutral index of deployed projects
/home/ubuntu/apps/<project>/                 # one directory per project
```

The shared host file only does three things: set proxy headers,
`include /etc/nginx/projects.d/*.conf;`, and return 404 for unclaimed paths.

## Port registry

| Ports | Project | Purpose |
|---|---|---|
| 5001 | qhr-attendance | Backend API |
| 3002 | qhr-attendance | Marketing site |
| 3003 | qhr-attendance | Admin console |
| 3010-3019 | *free* | next project |
| 5010-5019 | *free* | next project APIs |

PM2 process names are prefixed per project (`qhr-backend`, `qhr-admin`,
`qhr-landing`), so `pm2 restart qhr-*` never touches another project.

## Adding a new project

1. Put the code in `/home/ubuntu/apps/<project>/` and bind its processes to
   `127.0.0.1` on ports claimed above.
2. Name every PM2 app `<project>-<role>` and start from that project's own
   ecosystem file.
3. Create `/etc/nginx/projects.d/<project>.conf`:

```nginx
location = /myapp        { proxy_pass http://127.0.0.1:3010; }
location ^~ /myapp/api/  { rewrite ^/myapp(/api/.*)$ $1 break; proxy_pass http://127.0.0.1:5010; }
location ^~ /myapp/      { proxy_pass http://127.0.0.1:3010; }
```

4. `sudo nginx -t && sudo systemctl reload nginx`
5. Add a link to `/var/www/shared-host/index.html`.

Use `^~` on every prefix so a project cannot be shadowed by the shared catch-all,
and so `/myapp` cannot swallow `/myapp-other`.

## Framework notes (learned the hard way here)

- **Next.js under a sub-path** needs `basePath` *and* `assetPrefix`. Both apps read
  `NEXT_PUBLIC_BASE_PATH` at build *and* runtime, so the value must be identical in
  the build command and the PM2 env, otherwise you get a 404.
- **`pm2 restart --update-env` does not reload the ecosystem file.** After changing
  env values run `pm2 delete <apps> && pm2 start <ecosystem>` — scoped to your own
  app names.
- **Do not redirect the bare prefix** (`/qhr` → `/qhr/`). Next already normalises the
  trailing slash the other way, which produces a redirect loop. Proxy both forms.
- **Call APIs with a relative base** (`/qhr/api/v1`). The deployment then works on the
  IP, the EC2 DNS name, and a future domain with no rebuild.
- **Internal navigation must use `next/link`**, never a plain `<a href="/register">`.
  Only `Link` prefixes `basePath`, so a bare anchor would resolve to `/register` and
  hit the shared-host 404. Plain `<a>` is fine for in-page anchors (`#pricing`) and
  for cross-app links built from an env var (`adminUrl`).
- **`/qhr/` returns a short redirect body**, since Next normalises the trailing slash
  back to `/qhr`. Smoke checks must request the bare prefix or pass `curl -L`,
  otherwise content assertions silently pass against an empty response.
- **Expo web** needs `experiments.baseUrl` (set via `EXPO_BASE_URL` in
  `app.config.js`) to emit correctly prefixed asset URLs.

## Verified isolation

`deploy/test-isolation.sh` adds a temporary second project at `/demo2`, confirms both
projects answer, removes it, and confirms QHR is untouched. Last run: all green,
`/demo2` returned 404 after removal while every QHR route stayed 200.
