# 🚀 Production Deployment Guide: Vercel + Render + Neon

This guide walks you through deploying your **Secure File Transfer** web application with the recommended modern cloud stack:
- 🎨 **Frontend:** [Vercel](https://vercel.com) *(Global Edge CDN, Instant Static Builds, Free SSL)*
- 🔌 **Backend:** [Render.com](https://render.com) *(Flask + Socket.IO Persistent WebSockets)*
- 🐘 **Database:** [Neon.tech](https://neon.tech) *(Serverless PostgreSQL, Auto-scaling, Free Tier)*
- ⏱️ **Keep-Alive:** [UptimeRobot](https://uptimerobot.com) *(Prevents Render from ever going to sleep!)*

---

## 📋 Step 1: Create Database on Neon (2 Minutes)

1. Go to **[Neon.tech](https://neon.tech)** and sign up / log in.
2. Click **"Create Project"**.
   - Project Name: `secure-file-transfer`
   - Region: Choose the one closest to you (e.g. `US East`, `EU Frankfurt`, `Asia Singapore`).
3. After creation, you will see your **Connection Details** on the Dashboard.
4. Copy the **Postgres Connection URI** string:
   ```text
   postgresql://transfer_user:randompassword@ep-cool-fog-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
   *(Save this string — you will paste it into Render in Step 2).*

---

## 🔌 Step 2: Deploy Backend on Render (3 Minutes)

1. Push your project code to a **GitHub Repository**.
2. Go to **[Render.com](https://render.com)** and log in.
3. Click **"New +"** $\rightarrow$ select **"Web Service"**.
4. Connect your GitHub repository.
5. Fill in the settings:
   - **Name:** `secure-file-transfer-api` (or any name you choose)
   - **Region:** Same region as your Neon database.
   - **Branch:** `main`
   - **Runtime:** `Python 3`
   - **Build Command:**
     ```bash
     pip install -r requirements.txt
     ```
   - **Start Command:**
     ```bash
     python app.py
     ```
   - **Plan:** `Free`

6. Under **Environment Variables**, add the following 4 keys:
   | Key | Value | Notes |
   | :--- | :--- | :--- |
   | `FLASK_ENV` | `production` | Enables secure cross-domain session cookies |
   | `SECRET_KEY` | *(Generate any 32-char random string)* | E.g. `k8s9d7f6a5s4d3f2g1h0j2k4l6z8x0c2` |
   | `DATABASE_URL` | `postgresql://...` | Paste your **Neon Connection URI** from Step 1 |
   | `CORS_ORIGIN` | `*` | Or your Vercel URL once created in Step 3 |
   | `SOCKETIO_ASYNC_MODE` | `threading` | Production real-time socket engine |

7. Click **"Create Web Service"**.
8. Wait ~1 minute for Render to deploy. Once live, copy your **Backend Render URL**:
   👉 E.g. **`https://secure-file-transfer-api.onrender.com`**

---

## ⏱️ Step 3: Keep Render Awake 24/7 (Prevent Sleeping)

By default, Render's free tier sleeps after 15 minutes of inactivity. We prevent this using a free uptime ping:

1. Go to **[UptimeRobot.com](https://uptimerobot.com)** and sign up for a free account.
2. Click **"+ Add New Monitor"**.
   - **Monitor Type:** `HTTP(s)`
   - **Friendly Name:** `Secure Transfer API`
   - **URL (or IP):** `https://your-backend-name.onrender.com/`
   - **Monitoring Interval:** `Every 5 minutes`
3. Click **"Create Monitor"**.
4. **Done!** UptimeRobot will ping your Render backend every 5 minutes so it **never sleeps and stays active 24/7 with zero cold starts!**

---

## 🎨 Step 4: Deploy Frontend on Vercel (2 Minutes)

1. Go to **[Vercel.com](https://vercel.com)** and log in with GitHub.
2. Click **"Add New..."** $\rightarrow$ **"Project"**.
3. Select your GitHub repository.
4. In the configuration screen:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click "Edit" and choose **`frontend`**
5. Expand the **Environment Variables** section and add:
   | Key | Value |
   | :--- | :--- |
   | `VITE_API_URL` | `https://your-backend-name.onrender.com` *(Paste your Render URL from Step 2)* |
6. Click **"Deploy"**.
7. Vercel will build and deploy your frontend in ~20 seconds.
8. Click the generated live link (e.g. **`https://secure-file-transfer.vercel.app`**)!

---

## ✅ Step 5: Final Check & Verification

1. Open your live Vercel URL in your browser.
2. Register a new user account $\rightarrow$ Log in.
3. Open a second browser window / incognito tab and register a second account.
4. Go to **Contacts** $\rightarrow$ Generate connection key $\rightarrow$ Pair the two users.
5. Go to **Live Transfer** $\rightarrow$ Select any file $\rightarrow$ Stream live at full bandwidth!

---

## 🔒 Summary Architecture Diagram

```mermaid
flowchart LR
    Browser([User Browser]) -->|Loads React UI in 50ms| Vercel[Vercel Edge CDN\n(Frontend)]
    Browser -->|API Requests & Real-time WebSockets| Render[Render Web Service\n(Python Flask + Socket.IO)]
    Render -->|Persistent E2EE Metadata & History| Neon[(Neon Serverless\nPostgreSQL)]
    UptimeRobot[UptimeRobot\n(5-min Keep Alive)] -.->|Ping| Render
    Browser <-->|WebRTC Direct P2P 100% Wire Speed| Peer([Remote Peer Browser])
```
