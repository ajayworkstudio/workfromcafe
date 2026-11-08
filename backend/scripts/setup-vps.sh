#!/usr/bin/env bash
# Step 4a: siapkan VPS Ubuntu 24.04 untuk API Go WFC Hunters.
# Jalankan sekali sebagai root: bash setup-vps.sh
# Aman dijalankan ulang. Password database dibuat acak di server dan tidak pernah ditampilkan.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a
GO_VERSION=1.24.7

echo "== 1/7 Update sistem"
apt-get update -q
apt-get -y -q upgrade
apt-get install -y -q curl ca-certificates gnupg ufw fail2ban unattended-upgrades git openssl
timedatectl set-timezone Asia/Jakarta

echo "== 2/7 Swap 1 GB (RAM VPS hanya 1 GB)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== 3/7 Firewall: hanya SSH, HTTP, HTTPS"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
systemctl enable --now fail2ban >/dev/null

echo "== 4/7 PostgreSQL 17 (hanya bisa diakses dari dalam server)"
if ! command -v /usr/lib/postgresql/17/bin/postgres >/dev/null; then
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt noble-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -q
  apt-get install -y -q postgresql-17
fi

echo "== 5/7 Caddy (HTTPS otomatis)"
if ! command -v caddy >/dev/null; then
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt -o /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -y -q caddy
fi

echo "== 6/7 Go $GO_VERSION"
if [ "$(/usr/local/go/bin/go version 2>/dev/null | awk '{print $3}')" != "go$GO_VERSION" ]; then
  rm -rf /usr/local/go
  curl -fsSL "https://go.dev/dl/go$GO_VERSION.linux-amd64.tar.gz" | tar -C /usr/local -xz
fi
ln -sf /usr/local/go/bin/go /usr/local/bin/go

echo "== 7/7 User aplikasi, database, dan kunci GitHub"
id wfc >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/wfc --shell /usr/sbin/nologin wfc
install -d -m 750 -o root -g wfc /etc/wfc-api
if [ ! -f /etc/wfc-api/env ]; then
  PW=$(openssl rand -hex 24)
  runuser -u postgres -- psql -q -v ON_ERROR_STOP=1 -c "create role wfc_api login password '$PW'"
  runuser -u postgres -- createdb wfchunters
  umask 027
  cat > /etc/wfc-api/env <<EOF
PORT=8080
DATABASE_URL=postgres://wfc_api:$PW@127.0.0.1:5432/wfchunters?sslmode=disable
ALLOWED_ORIGINS=https://www.wfchunters.com,https://wfchunters.com
EOF
  chown root:wfc /etc/wfc-api/env
  unset PW
fi
# Kunci khusus untuk mengunduh repo (read-only). Kunci publiknya ditambahkan di GitHub > Deploy keys.
[ -f /root/.ssh/wfc_deploy ] || { install -d -m 700 /root/.ssh; ssh-keygen -q -t ed25519 -N "" -C "wfc-vps-deploy" -f /root/.ssh/wfc_deploy; }

echo
echo "================ RINGKASAN (aman dikirim ke Claude) ================"
echo "OS        : $(. /etc/os-release; echo "$PRETTY_NAME")"
echo "IP publik : $(curl -fsS4 --max-time 5 https://ifconfig.me || echo tidak-terbaca)"
echo "Postgres  : $(runuser -u postgres -- psql -tAc 'show server_version') | listen: $(runuser -u postgres -- psql -tAc 'show listen_addresses')"
echo "Database  : $(runuser -u postgres -- psql -tAc "select string_agg(datname, ',') from pg_database where datname = 'wfchunters'")"
echo "Caddy     : $(caddy version | awk '{print $1}')"
echo "Go        : $(go version | awk '{print $3}')"
echo "Swap      : $(free -m | awk '/Swap/ {print $2 " MB"}')"
echo "Firewall  : $(ufw status | head -1)"
ufw status | grep ALLOW | grep -v v6 | awk '{print "            terbuka: " $1}'
echo "Kunci GitHub (publik, tempel di GitHub > repo > Settings > Deploy keys):"
cat /root/.ssh/wfc_deploy.pub
echo "===================================================================="
