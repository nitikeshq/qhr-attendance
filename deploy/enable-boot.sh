#!/usr/bin/env bash
# Makes the QHR PM2 processes and nginx start automatically after a reboot.
set -eu
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -3
pm2 save | tail -1
sudo systemctl enable nginx >/dev/null 2>&1 || true
echo "pm2-ubuntu: $(systemctl is-enabled pm2-ubuntu 2>/dev/null || echo unknown)"
echo "nginx:      $(systemctl is-enabled nginx 2>/dev/null || echo unknown)"
