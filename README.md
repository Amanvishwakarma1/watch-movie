# Movie Max — Movie Streaming MVP

React + Vite frontend, Express API, Neon PostgreSQL, Mux video hosting. Built to run entirely on free tiers.

## How the pieces connect

```
Browser ──(movie list / details)──► API (Render) ──► Neon (movie records: titles, Mux IDs)
   │
   ├──(plays video, loads poster)───► Mux (HLS streaming + thumbnails; media never passes through the API)
   │
   └──(admin upload, URL from API)──► Mux direct upload
```

- **Neon** stores only metadata: title, description, genre, year, and the Mux asset / playback IDs.
- **Mux** stores, transcodes and streams the video (adaptive HLS). The poster is a frame from the video, served by Mux as a thumbnail, so there is no separate poster upload.
- **The API** connects the two: it serves the catalog from Neon, creates Mux direct-upload URLs for the admin, checks the video is ready on Mux before saving a movie, and deletes the Mux asset when a movie is deleted. Video bytes never go through it, which keeps it within Render's free 512 MB instance.

## Requirements
- Node.js 20+
- Neon, Mux and Render accounts (all free tier)

## 1. Neon (free tier database)
1. Sign up at neon.tech and create a project (Free plan). Pick the region closest to your Render region (e.g. AWS `us-east-1` / Render Virginia, or AWS `ap-southeast-1` / Render Singapore) to keep queries fast.
2. In the project dashboard click **Connect**, turn on **Connection pooling**, and copy the connection string. It looks like:
   `postgresql://neondb_owner:…@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
3. Paste it unchanged as `DATABASE_URL`. The API handles `sslmode` and `channel_binding` itself.

No SQL editor step: on every start the API creates the tables (`backend/sql/schema.sql`, idempotent) and creates or updates the admin account. If Neon's compute is suspended, startup waits for it to wake and retries.

## 2. Mux (video hosting)
In the Mux dashboard open **Settings → API Access Tokens**, create a token with **Mux Video** read + write access, and copy the **Token ID** and **Secret Key** (the secret is shown only once). They go in `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET`. No webhook is needed: the dashboard polls the API until Mux finishes processing.

## 3. Configure `.env`
Both apps read a `.env` file that is git-ignored (it holds secrets and must never be committed):

| File | Fill in |
|---|---|
| `backend/.env` | `DATABASE_URL` (Neon), `MUX_TOKEN_ID` / `MUX_TOKEN_SECRET`, `ADMIN_PASSWORD` (10+ chars). `JWT_SECRET` is already generated. |
| `frontend/.env` | `VITE_API_BASE_URL`, already `http://localhost:5000` for local use. |

The API refuses to start while any placeholder value is left, and says which ones need filling in.

## 4. Run locally
```bash
cd backend
npm install
npm run dev
```
In another terminal:
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173. Sign in at `/admin/login` with `ADMIN_USERNAME` / `ADMIN_PASSWORD`. To change the password, edit `.env` and restart.

## 5. Deploy on Render (free)
`.env` files are not pushed to GitHub, so Render gets the same values through its **Environment** settings.

### Option A: Blueprint (recommended)
Push the repo to GitHub, then in Render choose **New → Blueprint** and select the repo. `render.yaml` creates:
- `nightscreen-api`: free Node web service (root `backend`, health check `/api/health`, `JWT_SECRET` auto-generated)
- `nightscreen-web`: static site (root `frontend`, SPA rewrite `/*` → `/index.html` already configured)

Render asks for the secret values: copy them from `backend/.env` (`DATABASE_URL` is your Neon pooled string). For the two URLs, first deploy, then set:
- `FRONTEND_URL` on the API = the static site URL, e.g. `https://nightscreen-web.onrender.com` (no trailing slash; comma-separate several origins)
- `VITE_API_BASE_URL` on the static site = the API URL, e.g. `https://nightscreen-api.onrender.com`. This value is baked in at build time, so trigger **Manual Deploy → Clear build cache & deploy** on the static site after changing it.

### Option B: by hand
- **Web Service**: root `backend`, build `npm install`, start `npm start`, health check `/api/health`, plan Free, env vars = the keys in `backend/.env` with `NODE_ENV=production` and a new random `JWT_SECRET`.
- **Static Site**: root `frontend`, build `npm install && npm run build`, publish `dist`, env `VITE_API_BASE_URL`. Under **Redirects/Rewrites** add source `/*`, destination `/index.html`, action **Rewrite**.

## Free-tier limits to know
| Service | Limit | Effect here |
|---|---|---|
| Render free web service | Sleeps after ~15 min idle; waking takes up to ~1 min | The first visitor after a quiet period sees "Waking up the server…" while the catalog loads. The static frontend itself never sleeps. |
| Mux | Plan limits on stored assets, video length and delivery minutes (see your Mux billing page; the free plan is for trying things out) | Mux has no per-file size cap like Cloudinary's 100 MB, so full-length movies upload fine. Streaming and storage are billed by minutes, so watch usage in the Mux dashboard. |
| Neon free | 0.5 GB storage per project; monthly compute-hour allowance; compute suspends after ~5 min idle | The first query after a pause takes a second or two. Metadata is tiny, so storage isn't a concern. The health check (`/api/health`) doesn't touch the database, and idle connections close after 30 s, so the database can suspend and save compute hours. |

## Admin auth
Admin sign-in returns a JWT (8 h) that the dashboard keeps in `sessionStorage` and sends as `Authorization: Bearer …`. Cookies are not used because the frontend and API are on different `onrender.com` sites, and browsers block cross-site cookies. Rotating `JWT_SECRET` signs everyone out.

## Supported media
- Video: almost any format (MP4, MOV, MKV, WebM…). Mux converts it for streaming, so MOV works too.
- Poster: taken automatically from the video (Mux thumbnail).

If an upload or publish fails partway, the dashboard asks the API to delete the video it already sent to Mux.

## Important
Only upload videos and images you own or have permission to distribute. Mux playback URLs are public and can be shared. This MVP is not a DRM system.

# watch-movie
