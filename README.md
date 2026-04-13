# NDBSL — Synology NAS Deployment Guide

This guide walks through deploying the NDBSL web app on a **Synology NAS** (DSM 7.x) using Docker Compose, and configuring it to serve under your **university subdomain** (e.g. `ndbsl.chungnam.ac.kr`).

---

## Prerequisites

- Synology NAS with **DSM 7.2 or later**
- **Container Manager** (or Docker) package installed from Package Center
- SSH access to the NAS enabled (Control Panel → Terminal & SNMP → Enable SSH service)
- University subdomain pointed to your NAS's public IP (contact your university IT department)
- A domain name pointed at your NAS IP — your university's IT will give you the subdomain (e.g. `ndbsl.university.ac.kr`) and should set the DNS A record to your NAS public IP

---

## Step 1: Prepare the Synology NAS

### 1.1 Install required packages

In **Package Center**, install:
- Container Manager (Docker)
- Text Editor (optional, for editing config files)

### 1.2 Enable SSH

1. Control Panel → Terminal & SNMP → Terminal
2. Check "Enable SSH service" → port 22
3. Apply

### 1.3 Connect via SSH

From your computer (Mac/Linux terminal or Windows PowerShell):

```bash
ssh your_admin_username@nas_local_ip
# Example: ssh admin@192.168.1.100
```

### 1.4 Create project directory

```bash
sudo mkdir -p /volume1/docker/ndbsl
sudo chown -R $(whoami):users /volume1/docker/ndbsl
```

---

## Step 2: Copy the Application Files

### Option A: Git (recommended)

If you have Git installed on the NAS or transfer via `git clone`:

```bash
cd /volume1/docker/ndbsl
git clone https://github.com/omiaemmanuel/ndbsl.git .
```

### Option B: SCP / File Station

From your development machine:

```bash
scp -r /path/to/Cloned-repo/* admin@nas_ip:/volume1/docker/ndbsl/
```

Or use **Synology File Station** to upload the project zip and extract it.

---

## Step 3: Configure Environment Variables

```bash
cd /volume1/docker/ndbsl
cp .env.example .env
nano .env   # or vi .env
```

Edit the `.env` file:

```env
# Database
DB_PASSWORD=choose_a_strong_password_here

# JWT secrets (use random 64-char strings)
JWT_SECRET=replace_with_random_64_char_string
JWT_REFRESH_SECRET=replace_with_another_random_64_char_string

# MinIO (local S3-compatible file storage)
MINIO_USER=minioadmin
MINIO_PASS=choose_a_minio_password

# URLs (replace with our actual subdomain from CNU)
FRONTEND_URL=https://sensorspace.cnu.ac.kr
VITE_API_URL=https://sensorspace.cnu.ac.kr

# App
NODE_ENV=production
PORT=4000
```

Generate random secrets:
```bash
openssl rand -hex 32
# Run twice — one for JWT_SECRET, one for JWT_REFRESH_SECRET
```

---

## Step 4: Update docker-compose.yml for Production

Create a production-specific override file:

```bash
nano /volume1/docker/ndbsl/docker-compose.prod.yml
```

```yaml
version: '3.9'

services:
  db:
    image: postgres:15
    restart: always
    environment:
      POSTGRES_DB: ndbsl
      POSTGRES_USER: ndbsl
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - /volume1/docker/ndbsl/data/postgres:/var/lib/postgresql/data
    # Not exposed externally — only internal Docker network

  minio:
    image: minio/minio
    restart: always
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_PASS}
    volumes:
      - /volume1/docker/ndbsl/data/minio:/data
    # Only expose MinIO internally; access via backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: always
    environment:
      DATABASE_URL: postgresql://ndbsl:${DB_PASSWORD}@db:5432/ndbsl
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      S3_ENDPOINT: http://minio:9000
      S3_BUCKET: ndbsl-files
      S3_ACCESS_KEY: ${MINIO_USER}
      S3_SECRET_KEY: ${MINIO_PASS}
      NODE_ENV: production
      PORT: 4000
      FRONTEND_URL: ${FRONTEND_URL}
    ports:
      - "4000:4000"   # Exposed to reverse proxy
    depends_on:
      - db
      - minio

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        VITE_API_URL: ${VITE_API_URL}
    restart: always
    ports:
      - "3000:80"     # Nginx serves the built React app
    depends_on:
      - backend

volumes: {}   # Named volumes replaced with bind mounts above
```

Create data directories:

```bash
mkdir -p /volume1/docker/ndbsl/data/postgres
mkdir -p /volume1/docker/ndbsl/data/minio
```

---

## Step 5: Build and Start the Application

```bash
cd /volume1/docker/ndbsl

# Build all images
sudo docker compose -f docker-compose.prod.yml --env-file .env build

# Start in background
sudo docker compose -f docker-compose.prod.yml --env-file .env up -d

# Check all containers are running
sudo docker compose -f docker-compose.prod.yml ps
```

Expected output:
```
NAME                STATUS
ndbsl-db-1          Up
ndbsl-minio-1       Up
ndbsl-backend-1     Up
ndbsl-frontend-1    Up
```

### Run database migrations and seed

```bash
# Wait ~10 seconds for DB to be ready, then:
sudo docker compose -f docker-compose.prod.yml exec backend npx prisma db push
sudo docker compose -f docker-compose.prod.yml exec backend npx tsx prisma/seed.ts
```

This creates the database schema and the default admin account (`admin` / `admin1234`).

---

## Step 6: Set Up Reverse Proxy (Synology Nginx)

Synology DSM has a built-in reverse proxy. This routes your subdomain to the Docker containers.

### 6.1 Open Reverse Proxy settings

1. Control Panel → Login Portal → Advanced tab → Reverse Proxy
2. Click **Create**

### 6.2 Configure Frontend proxy rule

| Field | Value |
|-------|-------|
| Description | NDBSL Frontend |
| Source: Protocol | HTTPS |
| Source: Hostname | `ndbsl.university.ac.kr` |
| Source: Port | `443` |
| Destination: Protocol | HTTP |
| Destination: Hostname | `localhost` |
| Destination: Port | `3000` |

Click **Save**.

### 6.3 Configure Backend API proxy rule

| Field | Value |
|-------|-------|
| Description | NDBSL Backend API |
| Source: Protocol | HTTPS |
| Source: Hostname | `ndbsl.university.ac.kr` |
| Source: Port | `443` |
| Source: Path | `/api` |
| Destination: Protocol | HTTP |
| Destination: Hostname | `localhost` |
| Destination: Port | `4000` |

> **Important:** The path `/api/*` must proxy to the backend. This way, `https://ndbsl.university.ac.kr/api/...` hits the Node.js server and everything else hits the React frontend.

Click **Save**.

### 6.4 Custom Headers (WebSocket support, if needed)

In the reverse proxy rules, click the rule → **Custom Header** tab → Add:

```
Header: Upgrade       Value: $http_upgrade
Header: Connection    Value: $connection_upgrade
```

---

## Step 7: SSL Certificate (HTTPS)

### Option A: Let's Encrypt (recommended)

1. Control Panel → Security → Certificate
2. Click **Add** → "Get a certificate from Let's Encrypt"
3. Domain name: `ndbsl.university.ac.kr`
4. Email: your email for renewal notices
5. Click **Done** — DSM auto-renews this every 90 days

> **Note:** Let's Encrypt requires your NAS to be reachable on port 80 and 443 from the internet. Work with your university IT to open these ports on the firewall/router and NAT them to your NAS.

### Option B: University-provided SSL certificate

If your university provides a wildcard or domain certificate:
1. Control Panel → Security → Certificate → Add → "Import certificate"
2. Upload the `.crt`, `.key`, and optional chain file
3. Assign it to your reverse proxy rules

---

## Step 8: DNS and Port Forwarding

Your university IT department needs to:

1. **Set DNS A record**: `ndbsl.university.ac.kr` → your NAS public IP
2. **Open firewall ports**: 80 (HTTP redirect) and 443 (HTTPS) pointing to your NAS LAN IP

On your router/gateway (if you manage it):
- Port forward `80 → NAS_LAN_IP:80`
- Port forward `443 → NAS_LAN_IP:443`

Synology DSM listens on 80/443 by default — you may need to move DSM's default ports if there's a conflict:
- Control Panel → Login Portal → DSM tab → Change DSM HTTP/HTTPS ports to e.g., 5000/5001

---

## Step 9: Update Frontend API URL

The frontend React app needs to know the backend URL at build time. Since both frontend and backend are served from the same domain (using path-based routing through the reverse proxy), set:

```env
VITE_API_URL=https://ndbsl.university.ac.kr
```

The frontend calls `/api/...` which the reverse proxy routes to the backend. No CORS issues since they share the same origin.

---

## Step 10: Verify the Deployment

```bash
# Test backend health
curl https://ndbsl.university.ac.kr/api/health

# Expected response:
# {"status":"ok","timestamp":"..."}

# View backend logs
sudo docker compose -f docker-compose.prod.yml logs -f backend

# View all logs
sudo docker compose -f docker-compose.prod.yml logs -f
```

Open `https://ndbsl.university.ac.kr` in your browser. You should see the NDBSL landing page. Log in with:
- Username: `admin`
- Password: `admin1234`

**Change the admin password immediately after first login.**

---

## Step 11: Keeping the App Running After NAS Restart

The `restart: always` in docker-compose ensures containers restart automatically when DSM boots.

You can also add a **Scheduled Task** in DSM:
1. Control Panel → Task Scheduler → Create → Triggered Task → Boot-up
2. Task: `sudo docker compose -f /volume1/docker/ndbsl/docker-compose.prod.yml up -d`

---

## Maintenance

### Update the application

```bash
cd /volume1/docker/ndbsl
git pull origin main

# Rebuild and restart
sudo docker compose -f docker-compose.prod.yml --env-file .env build
sudo docker compose -f docker-compose.prod.yml --env-file .env up -d

# Apply any new DB migrations
sudo docker compose -f docker-compose.prod.yml exec backend npx prisma db push
```

### Backup the database

```bash
# Create a database dump
sudo docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U ndbsl ndbsl > /volume1/docker/ndbsl/backup_$(date +%Y%m%d).sql

# Or backup the entire Postgres data directory via Synology Hyper Backup
# Point it at: /volume1/docker/ndbsl/data/postgres
```

### View resource usage

```bash
sudo docker stats
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `502 Bad Gateway` | Backend container not running. Check: `docker compose logs backend` |
| Login returns "Login failed" | Backend not reachable. Check the `/api` proxy rule hostname points to `localhost` |
| Files not uploading | MinIO container issue. Check: `docker compose logs minio` |
| SSL certificate error | Let's Encrypt requires port 80 open. Check router/firewall NAT rules |
| Database connection error | Wait 15s after starting — Postgres takes time to initialize |
| `Prisma schema not found` | Run `docker compose exec backend npx prisma db push` |

---

## Architecture Summary

```
Internet
   │
   ▼
[University Subdomain: ndbsl.university.ac.kr]
   │  (DNS A record → NAS public IP)
   │
   ▼
[Router/Firewall]
   │  (Port 80/443 NAT → NAS LAN IP)
   │
   ▼
[Synology DSM — Reverse Proxy (Nginx)]
   ├── /api/*  ──────────────────→  [Backend Container :4000]
   │                                    │
   │                                    ├── [PostgreSQL :5432]
   │                                    └── [MinIO :9000]
   │
   └── /*  ──────────────────────→  [Frontend Container :3000]
                                        (Nginx serving built React app)
```

---

*For questions, contact the lab administrator or open an issue in the project repository.*
