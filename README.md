[README.md](https://github.com/user-attachments/files/29184254/README.md)
# TriCoach PWA — Setup Guide

A personal Ironman Barcelona 2026 training dashboard. Runs as a Progressive Web App on Android (or any browser).

---

## What it does

- **Dashboard** — race countdown, week volume (swim/bike/run), recent activities from Strava
- **Analytics** — HR zone distribution, weekly swim/bike/run volume trends (last 8 weeks)
- **AI Debrief** — weekly coaching review powered by Claude API, using your actual Strava data
- **Race Plan** — Barcelona execution strategy, nutrition protocol, Amsterdam notes
- **Settings** — Strava OAuth config, Claude API key

---

## Quick Start — Deploy to GitHub Pages (free)

### 1. Create a Strava API Application

1. Go to https://www.strava.com/settings/api
2. Create an application (name: TriCoach, website: your GitHub Pages URL)
3. Set **Authorization Callback Domain** to your GitHub Pages domain (e.g. `yourusername.github.io`)
4. Copy your **Client ID** and **Client Secret**

### 2. Deploy to GitHub Pages

1. Create a new GitHub repository (e.g. `tricoach`)
2. Upload `index.html` and `manifest.json` to the repo root
3. Go to repo Settings → Pages → Source: `main` branch, `/ (root)`
4. Your app is live at `https://yourusername.github.io/tricoach/`

### 3. Update the Strava OAuth redirect

In `index.html`, the redirect URI is set automatically to `window.location.origin + window.location.pathname` — this will work on GitHub Pages without changes.

Make sure your Strava app's **Authorization Callback Domain** matches your Pages domain exactly.

### 4. First-time setup in the app

1. Open the app on your phone
2. Go to **Settings** tab
3. Enter your Strava Client ID and Client Secret
4. Enter your Claude API key (from console.anthropic.com)
5. Tap **Save Settings**
6. Go back to Dashboard and tap **Connect with Strava**
7. Authorise — you'll be redirected back and data will load

---

## Install on Android as PWA

1. Open the app URL in **Chrome** on your Android phone
2. Tap the **⋮** menu (top right)
3. Tap **"Add to Home screen"**
4. Confirm — TriCoach now appears as an app icon
5. Launch from your home screen — it opens full-screen, no browser chrome

---

## AI Weekly Debrief

The debrief tab uses the Claude API directly from your browser to generate a structured coaching review. It:
- Pulls your last 7 days of Strava activities
- Sends them to Claude Sonnet with your full athlete context (zones, Bolton lessons, Barcelona targets)
- Returns a direct, coach-style analysis in ~5 seconds

**Cost:** Each debrief uses approximately 1,000 tokens (~$0.003 at current pricing).

**API Key:** Get yours at https://console.anthropic.com — add it in Settings.

---

## Linking to your Claude Project

The Debrief page has a direct link to `claude.ai/projects`. For deeper coaching:
1. Open the project in Claude
2. The Strava MCP will pull fresh data
3. Use the weekly review command ("weekly review") for the full structured debrief

---

## Local development

Just open `index.html` in a browser. Note: Strava OAuth won't work on `file://` — use a local server:

```bash
# Python
python3 -m http.server 8080

# Node
npx serve .
```

Then set your Strava app's callback domain to `localhost`.

---

## Files

```
tricoach-pwa/
├── index.html      # Everything — HTML, CSS, JS in one file
├── manifest.json   # PWA manifest
└── README.md       # This file
```

Icons (icon-192.png, icon-512.png) are referenced in manifest.json but optional — the app works without them.
