#!/usr/bin/env bash
# Step 4b: pasang atau perbarui API Go di VPS. Jalankan sebagai root: bash deploy-api.sh
# Pertama kali: unduh kode, muat struktur database, buat layanan systemd dan HTTPS.
# Berikutnya: ambil kode terbaru, build ulang, restart. Aman dijalankan berulang.
set -euo pipefail
DOMAIN=api.wfchunters.com
REPO=git@github.com:ajayworkstudio/workfromcafe.git
SRC=/opt/wfc/src
BIN=/opt/wfc/bin/wfc-api
export GIT_SSH_COMMAND="ssh -i /root/.ssh/wfc_deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

echo "== 1/6 Ambil kode (hanya folder backend)"
if [ ! -d "$SRC/.git" ]; then
  git clone -q --filter=blob:none --sparse "$REPO" "$SRC"
  git -C "$SRC" sparse-checkout set backend
else
  git -C "$SRC" pull -q --ff-only
fi
echo "   versi: $(git -C "$SRC" log -1 --format='%h %s')"

echo "== 2/6 Build"
install -d -o wfc -g wfc /opt/wfc/bin
(cd "$SRC/backend" && go test ./... >/dev/null && go build -trimpath -o "$BIN.new" ./cmd/api)
mv "$BIN.new" "$BIN"

echo "== 3/6 Struktur database"
tables=$(runuser -u postgres -- psql -d wfchunters -tAc "select count(*) from pg_tables where schemaname = 'public'")
if [ "$tables" -eq 0 ]; then
  runuser -u postgres -- psql -d wfchunters -q -v ON_ERROR_STOP=1 \
    -f "$SRC/backend/db/00_supabase_shim.sql" -f "$SRC/backend/db/schema.sql" >/dev/null
  echo "   dimuat: $(runuser -u postgres -- psql -d wfchunters -tAc "select count(*) from pg_tables where schemaname = 'public'") tabel"
else
  echo "   sudah ada: $tables tabel, tidak diubah"
fi

echo "== 4/6 Layanan systemd"
grep -q '^HOST=' /etc/wfc-api/env || sed -i '1i HOST=127.0.0.1' /etc/wfc-api/env
cat > /etc/systemd/system/wfc-api.service <<'EOF'
[Unit]
Description=WFC Hunters API (Go)
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
User=wfc
Group=wfc
EnvironmentFile=/etc/wfc-api/env
ExecStart=/opt/wfc/bin/wfc-api
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable -q wfc-api
systemctl restart wfc-api
sleep 2
systemctl is-active --quiet wfc-api || { journalctl -u wfc-api -n 20 --no-pager; exit 1; }

echo "== 5/6 HTTPS lewat Caddy"
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
	encode zstd gzip
	reverse_proxy 127.0.0.1:8080
	header -Server
}
EOF
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
systemctl reload caddy || systemctl restart caddy

echo "== 6/6 Cek"
echo "   lokal   : $(curl -fsS 127.0.0.1:8080/health || echo GAGAL)"
dns=$(getent ahostsv4 "$DOMAIN" | awk 'NR==1 {print $1}')
me=$(curl -4 -fsS --max-time 5 https://ifconfig.me || true)
echo "   DNS     : $DOMAIN -> ${dns:-belum-ada} (VPS: $me)"
if [ -n "$dns" ] && [ "$dns" = "$me" ]; then
  sleep 5
  echo "   publik  : $(curl -fsS --max-time 20 "https://$DOMAIN/health" || echo 'belum, sertifikat HTTPS mungkin masih dibuat. Coba lagi 1 menit: curl https://'"$DOMAIN"'/health')"
else
  echo "   publik  : DNS belum mengarah ke VPS. Tunggu, lalu jalankan skrip ini lagi."
fi
