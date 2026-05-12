# 💷 Emily & Louis — Budget Planner

---

## Hosting on GitHub + Vercel (everything in one place)

### Step 1 — Push to GitHub

1. Go to [github.com](https://github.com) and create a new repository
2. Open a terminal in this folder and run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Step 2 — Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New → Project**, select your repository, click **Deploy**
3. Wait ~30 seconds for it to go live

### Step 3 — Add the database (one click)

1. In your Vercel project dashboard, go to the **Storage** tab
2. Click **Create Database** → choose **KV**
3. Give it any name, click **Create & Continue**, then **Connect**
4. Click **Redeploy** on your latest deployment

That's it — the database is connected and environment variables are added automatically.

---

## Running locally

Install the Vercel CLI, then:

```bash
npm install
vercel login
vercel link   # links to your Vercel project (pulls in the KV env vars)
npm run dev   # runs on http://localhost:3000
```

---

## How sync works

- Changes save automatically ~1 second after you stop typing
- The small dot in the top nav shows the status (green = saved, amber = saving)
- The app checks for changes from the other person every 30 seconds while the tab is open
- If the internet drops mid-edit, changes are saved locally and synced when you reconnect

## Resetting data

Go to your Vercel dashboard → Storage → your KV database → CLI tab, and run:

```
del budget-data
```

Then reload the app.
