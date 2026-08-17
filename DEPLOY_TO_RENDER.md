# 🚀 Deploy Expense Tracker (AI/ML Edition) to Render — Free Tier Workbook

This workbook explains **exactly** how to push this full-stack app (Node/Express backend **+** React/Vite frontend **+** optional Python FastAPI ML microservice) onto [Render's free plan](https://render.com).

> The app is designed to run even **without** the ML service or a Gemini key (everything degrades gracefully), so you can deploy just the two core services (backend + frontend) for free and add the ML service later.

---

## 🧭 Architecture on Render

| Service | Type | Purpose | Free? |
|---|---|---|---|
| `expense-tracker-backend` | **Web Service** (Node) | REST API + AI copilot (uses Gemini + built-in rule fallback) | ✅ Free |
| `expense-tracker-frontend` | **Static Site** (Vite build) | React dashboard + chatbot UI | ✅ Free |
| `expense-tracker-ml` | **Web Service** (Python) | FastAPI categorizer / anomaly / text-to-query (optional) | ✅ Free (or skip) |

The backend is the **only** service that needs a database. You'll use **MongoDB Atlas** (free `M0` cluster) for `MONGO_URI`.

---

## 0️⃣ Pre-flight checklist

1. A [GitHub](https://github.com) account with this repo pushed.
2. A [Render](https://dashboard.render.com) account (sign up with GitHub).
3. A free [MongoDB Atlas](https://cloud.mongodb.com) cluster.
4. A free [Google Gemini API key](https://aistudio.google.com/app/apikey) (optional but recommended — powers the copilot's natural-language understanding).
5. (Optional) A [Upstash Redis](https://upstash.com) free instance for distributed rate limiting. If you skip it, the backend **automatically uses an in-memory fallback** (rate limiting still works, but per-instance).

---

## 1️⃣ MongoDB Atlas (free `M0`)

1. Create a project → **Database → Create → M0 Free**.
2. Region: pick one close to your Render region (e.g. `Oregon` / `Frankfurt`).
3. **Database Access → Add User** → username + password (save the password!).
4. **Network Access → Add IP** → `0.0.0.0/0` (Render IPs are dynamic; allow all).
5. **Clusters → Connect → Drivers → Node.js** → copy the connection string:
   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `<password>` with the one you created. This becomes `MONGO_URI`.

---

## 2️⃣ Backend — Render Web Service (Node)

1. **New → Web Service → Connect repo**.
2. Settings:
   - **Name:** `expense-tracker-backend`
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
3. **Environment → Add Environment Variables** (copy from `backend/.env.example`):

| Key | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | |
| `PORT` | `8000` | Render injects its own `$PORT`; our `server.js` uses `process.env.PORT || 5000`, so leave as `8000` or let Render set it (Render passes `PORT`). |
| `MONGO_URI` | your Atlas URI | **Secret** |
| `JWT_SECRET` | `openssl rand -hex 32` output | Generate locally; **Secret** |
| `CLIENT_URL` | `https://<frontend-service>.onrender.com` | Frontend URL from step 3 (add after creating it; you can edit later) |
| `GEMINI_API_KEY` | your Gemini key | Optional — copilot falls back to rule engine if blank |
| `AI_DAILY_QUOTA` | `10` | per-user daily AI queries |
| `REDIS_URL` | Upstash URL (optional) | Leave **empty** to use in-memory fallback |
| `ML_SERVICE_URL` | `https://<ml-service>.onrender.com` | Leave empty to skip ML microservice |

4. Click **Create Web Service**. Wait for the build/deploy. Note the **service URL** (`https://expense-tracker-backend.onrender.com`).

> 💡 **Free-tier sleep:** Render free web services spin down after 15 min of inactivity (cold start ~30–60s). That's expected. The frontend static site never sleeps.

---

## 3️⃣ Frontend — Render Static Site (Vite)

1. **New → Static Site → Connect repo**.
2. Settings:
   - **Name:** `expense-tracker-frontend`
   - **Root Directory:** `frontend/expense-tracker`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
   - **Instance Type:** Free (static sites are always free)
3. **Environment Variables:**
   | Key | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://<backend-service>.onrender.com` (the URL from step 2) |

4. **Redirects/Rewrites (important for SPA routing):** add a catch-all so React Router works:
   - Under *Redirects*, add:
     - **Source:** `/*`
     - **Destination:** `/index.html`
     - **Action:** `Rewrite`
5. Click **Create Static Site**.

⚠️ **CORS:** The backend `server.js` already sets `origin: process.env.CLIENT_URL || "*"`. Once the frontend URL is known, set `CLIENT_URL` on the backend to the exact frontend URL (and **redeploy** the backend) for stricter CORS. Until then `*` keeps it working.

---

## 4️⃣ (Optional) ML Microservice — Render Web Service (Python)

The Node backend already does categorization + anomaly detection **in-process** with graceful fallbacks, so **this step is optional**. Deploy it only if you want the dedicated FastAPI engine (TF-IDF categorization, IsolationForest).

1. **New → Web Service → Connect repo**.
2. Settings:
   - **Name:** `expense-tracker-ml`
   - **Root Directory:** `backend/ml`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** Free
3. After deploy, copy its URL and set `ML_SERVICE_URL` on the **backend** service env, then redeploy the backend.

The backend calls this service with a **2-second timeout** and silently falls back to its built-in engine if it's unreachable — so the app never breaks if the ML service is asleep.

---

## 5️⃣ Wire it all together (final env updates)

After all three services exist, go back and set:

- **Backend** `CLIENT_URL` = frontend URL → redeploy backend.
- **Backend** `ML_SERVICE_URL` = (optional) ML URL → redeploy backend.
- **Frontend** `VITE_API_BASE_URL` = backend URL (set in step 3 already).
- **Frontend** must be redeployed after changing `VITE_API_BASE_URL` (Vite bakes env at build time).

---

## 6️⃣ Verify the deploy

1. Open the **frontend** URL → register a user → add an expense.
2. Open the **AI Copilot** (bottom-right floating button) and try:
   - *"Show me a bar chart of my expenses grouped by category"*
   - *"Compare my total income vs total expenses"*
   - *"Show me the last 5 transactions"*
3. Hit the backend health endpoint: `GET https://<backend>/api/v1/ai/health` → should return `{"status":"online", "engine":"gemini-2.0-flash"|"rule-based-fallback", ...}`.

---

## 🧯 Troubleshooting

| Symptom | Fix |
|---|---|
| Frontend can't reach API (network errors) | Confirm `VITE_API_BASE_URL` points to the backend URL **and** redeploy the static site. |
| 401 on every request | `JWT_SECRET` mismatch (only one secret should exist). Set it once on backend; it's generated at signup/login, not in frontend. |
| AI copilot says "rule-based-fallback" | `GEMINI_API_KEY` is missing/invalid. Get a key from aistudio.google.com and set it; redeploy backend. |
| Rate limit 429 immediately | `REDIS_URL` empty → in-memory fallback per instance. Fine for free tier; add Upstash Redis for true distributed limits. |
| ML endpoints fail | Expected if ML service not deployed. Backend falls back automatically — safe to ignore. |
| Cold start delay on first load | Free tier spins down after inactivity. First request wakes it (~30–60s). |

---

## 💸 Cost summary (free tier)

- Backend web service: **Free** (750 hrs/mo, sleeps when idle)
- Frontend static site: **Free** (always on)
- MongoDB Atlas M0: **Free** (512 MB)
- Gemini API: **Free** tier (generous monthly quota)
- Upstash Redis: **Free** (optional)
- ⇒ **$0/month** to run the whole stack.

---

## 🔐 Security reminder

- `backend/.env` and `frontend/expense-tracker/.env` are **gitignored**. Never commit real secrets.
- The repo's committed `backend/.env` currently contains a real `MONGO_URI`/`JWT_SECRET`. **Rotate them** before any public deploy: create a new Atlas DB user + new `JWT_SECRET` (`openssl rand -hex 32`), and purge the old values from git history if the repo is/was public.
- Use **Render's encrypted environment variables** (not files) for all secrets in production.
