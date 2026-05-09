# Skyhawks Cricket Club — Production Deployment Guide

**Stack (Option A — 100% free tier)**

| Layer    | Service       | Free tier                              |
|----------|---------------|----------------------------------------|
| Frontend | Vercel        | Unlimited static deployments           |
| Backend  | Render.com    | 750 h/month (spins down after 15 min inactivity) |
| Database | Turso         | 500 MB, 1 billion row reads/month      |
| Images   | Cloudinary    | 25 GB storage, 25 GB bandwidth/month   |

---

## 1 — Prerequisites

- Node.js 18+ installed locally
- Accounts created at: [Turso](https://turso.tech), [Cloudinary](https://cloudinary.com), [Render](https://render.com), [Vercel](https://vercel.com)
- Code pushed to a GitHub repository

---

## 2 — Turso (Database)

1. Install the Turso CLI:
   ```bash
   curl -sSfL https://get.turso.io/install.sh | bash
   turso auth login
   ```

2. Create the database:
   ```bash
   turso db create skyhawks
   turso db show skyhawks          # note the URL
   turso db tokens create skyhawks # note the auth token
   ```

3. The database schema and demo accounts are seeded automatically on first startup — no manual SQL needed.

---

## 3 — Cloudinary

1. Sign up at [cloudinary.com](https://cloudinary.com).
2. From the **Dashboard**, note:
   - **Cloud name**
   - **API Key**
   - **API Secret**

---

## 4 — Backend on Render.com

1. Go to [render.com](https://render.com) → **New → Web Service**.
2. Connect your GitHub repo.
3. Configure the service:

   | Setting          | Value                          |
   |------------------|--------------------------------|
   | **Name**         | `skyhawks-api`                 |
   | **Root Dir**     | `backend`                      |
   | **Runtime**      | `Node`                         |
   | **Build Cmd**    | `npm install && npm run build` |
   | **Start Cmd**    | `npm start`                    |
   | **Instance Type**| Free                           |

4. Under **Environment Variables**, add:

   | Key                    | Value                                         |
   |------------------------|-----------------------------------------------|
   | `TURSO_DATABASE_URL`   | `libsql://your-db-name-your-org.turso.io`     |
   | `TURSO_AUTH_TOKEN`     | *(token from step 2)*                         |
   | `JWT_SECRET`           | *(random 64-char string)*                     |
   | `CLOUDINARY_CLOUD_NAME`| *(from Cloudinary dashboard)*                 |
   | `CLOUDINARY_API_KEY`   | *(from Cloudinary dashboard)*                 |
   | `CLOUDINARY_API_SECRET`| *(from Cloudinary dashboard)*                 |
   | `CORS_ORIGIN`          | `https://your-app.vercel.app` *(fill after step 5)* |
   | `NODE_VERSION`         | `20`                                          |

5. Click **Create Web Service**. Note the URL (e.g. `https://skyhawks-api.onrender.com`).

> **Free tier note:** The service spins down after 15 minutes of inactivity. The first request after spin-down takes ~30 s. Consider setting up a free uptime monitor (e.g. [UptimeRobot](https://uptimerobot.com)) to ping `/api/health` every 14 minutes.

---

## 5 — Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**.
2. Import your GitHub repo.
3. Configure:

   | Setting         | Value        |
   |-----------------|--------------|
   | **Root Dir**    | `frontend`   |
   | **Framework**   | Vite         |
   | **Build Cmd**   | `npm run build` |
   | **Output Dir**  | `dist`       |

4. Under **Environment Variables**, add:

   | Key            | Value                                      |
   |----------------|--------------------------------------------|
   | `VITE_API_URL` | `https://skyhawks-api.onrender.com`        |

5. Click **Deploy**. Note the URL (e.g. `https://skyhawks-cc.vercel.app`).

---

## 6 — Final wiring

1. Go back to Render → your service → **Environment** tab.
2. Update `CORS_ORIGIN` to your Vercel URL: `https://skyhawks-cc.vercel.app`.
3. Render will redeploy automatically.

---

## 7 — Verify the deployment

```bash
# Health check
curl https://skyhawks-api.onrender.com/api/health
# → {"status":"ok","app":"Skyhawks Cricket Club API"}

# Public data
curl https://skyhawks-api.onrender.com/api/public/about
```

Open the Vercel URL in a browser and:
- Visit the **About** page (no login needed)
- Log in with the demo admin account: `admin@skyhawks.com` / `Admin@123`
- Upload a logo and a banner photo to confirm Cloudinary works

---

## 8 — Local development

```bash
# Terminal 1 — backend
cd backend
cp .env.example .env          # fill in your real values (or use file:./skyhawks.db for local SQLite)
npm install
npm run dev                   # http://localhost:3001

# Terminal 2 — frontend
cd frontend
cp .env.example .env          # leave VITE_API_URL empty; Vite proxy handles /api → localhost:3001
npm install
npm run dev                   # http://localhost:5173
```

For local development you can omit `TURSO_DATABASE_URL` — the backend defaults to a local `file:./skyhawks.db` SQLite file.

---

## 9 — Demo accounts (seeded on first startup)

| Role     | Email                      | Password      |
|----------|----------------------------|---------------|
| Admin    | admin@skyhawks.com         | Admin@123     |
| Manager  | manager@skyhawks.com       | Manager@123   |
| Selector | selector@skyhawks.com      | Selector@123  |

> Change these passwords immediately after the first login in production.

---

## 10 — Environment variable reference

### Backend (`backend/.env`)

| Variable               | Required | Description                              |
|------------------------|----------|------------------------------------------|
| `TURSO_DATABASE_URL`   | Yes (prod)| LibSQL URL from Turso dashboard          |
| `TURSO_AUTH_TOKEN`     | Yes (prod)| Auth token from Turso dashboard          |
| `JWT_SECRET`           | Yes      | Random secret for signing JWT tokens     |
| `CLOUDINARY_CLOUD_NAME`| Yes      | Your Cloudinary cloud name               |
| `CLOUDINARY_API_KEY`   | Yes      | Your Cloudinary API key                  |
| `CLOUDINARY_API_SECRET`| Yes      | Your Cloudinary API secret               |
| `CORS_ORIGIN`          | Yes (prod)| Comma-separated list of allowed origins  |
| `PORT`                 | No       | Server port (default: 3001)              |

### Frontend (`frontend/.env`)

| Variable       | Required | Description                                          |
|----------------|----------|------------------------------------------------------|
| `VITE_API_URL` | Prod only| Full URL of the backend (e.g. https://…onrender.com) |
