#!/usr/bin/env bash
# Proves a second project can be added and removed on this host without
# affecting QHR. Creates a temporary static "demo2" project, verifies both
# projects respond, then removes it and re-verifies QHR.
set -eu

echo '=== add a temporary second project at /demo2 ==='
sudo mkdir -p /var/www/demo2
echo '<h1>demo2 project OK</h1>' | sudo tee /var/www/demo2/index.html >/dev/null
sudo tee /etc/nginx/projects.d/demo2.conf >/dev/null <<'CONF'
location ^~ /demo2/ {
    alias /var/www/demo2/;
    index index.html;
    try_files $uri $uri/ /demo2/index.html;
}
CONF
sudo nginx -t 2>&1 | tail -1
sudo systemctl reload nginx
sleep 2

echo
echo '=== both projects respond ==='
for p in / /demo2/ /qhr /qhr/admin /qhr/app/ /qhr/api/v1; do
  printf '%-16s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' -L "http://127.0.0.1$p")"
done
echo -n 'demo2 body:    '; curl -s http://127.0.0.1/demo2/

echo
echo '=== remove the second project ==='
sudo rm -f /etc/nginx/projects.d/demo2.conf
sudo rm -rf /var/www/demo2
sudo nginx -t 2>&1 | tail -1
sudo systemctl reload nginx
sleep 2

echo
echo '=== QHR still healthy, /demo2 gone ==='
for p in / /demo2/ /qhr /qhr/admin /qhr/app/ /qhr/api/v1 /qhr/health; do
  printf '%-16s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' -L "http://127.0.0.1$p")"
done
echo DONE
