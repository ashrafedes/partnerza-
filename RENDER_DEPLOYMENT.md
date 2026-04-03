# Partnerza Render Deployment Guide

## Required Environment Variables

Add these in Render Dashboard → Environment → Environment Variables:

### JWT Authentication
- `JWT_SECRET` - Auto-generated secret for JWT signing (or set manually)
- `JWT_EXPIRES_IN` - Optional (default: 24h)

### Firebase Admin SDK (Backend)
Get these from Firebase Console → Project Settings → Service Accounts → Generate New Private Key

- `FIREBASE_PROJECT_ID` - Your Firebase project ID (e.g., `partnerza`)
- `FIREBASE_CLIENT_EMAIL` - The service account email (e.g., `firebase-adminsdk-xxxxx@partnerza.iam.gserviceaccount.com`)
- `FIREBASE_PRIVATE_KEY` - The full private key including BEGIN/END markers

**IMPORTANT**: When pasting `FIREBASE_PRIVATE_KEY` in Render:
1. Copy the entire key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
2. The code handles newline escaping automatically with `.replace(/\\n/g, '\n')`
3. Or use literal newlines by pressing Shift+Enter in Render's env var input

### Optional Environment Variables
- `FIREBASE_DISABLED` - Set to `true` to disable Firebase (dev mode with mock auth)
- `NODE_ENV` - Set to `production` (already set in render.yaml)
- `PORT` - Set to `10000` (already set in render.yaml)

## Database Persistence (SQLite)

**Problem**: On Render free tier, the filesystem is ephemeral - SQLite data is lost on every deploy.

**Solutions**:

### Option 1: Render Disk (Recommended for Production)
1. In Render Dashboard → Disks → Create Disk
2. Mount path: `/data`
3. Size: 1GB (minimum)
4. Update `backend/db.js` to use `/data/db.sqlite` instead of local path

### Option 2: Auto-reseed on Deploy (Free Tier)
The app already auto-creates tables on startup (`db.js`). For free tier without a disk:
- Users will need to re-register after each deploy
- Or add a seed script to create default data

## Build & Start Commands

Already configured in `render.yaml`:
```yaml
buildCommand: cd frontend && npm install && npm run build && cd .. && npm install
startCommand: node backend/index.js
```

## Troubleshooting

### 401 Login Errors
If users exist in Firebase but not in SQLite:
- The login flow now auto-creates users in SQLite from Firebase
- Check Render logs for: "User not found in SQLite, auto-creating..."

### CORS Errors
Already configured to allow all origins in production.

### Static Files Not Loading
The backend serves frontend from `backend/public/` which is copied from `frontend/dist/` during build.

## Architecture

- **Single Service**: Backend (Express) serves both API and static frontend files
- **Unified Hosting**: Frontend and backend on same domain (`partnerza.onrender.com`)
- **No CORS Issues**: Relative API URLs work since both are same origin
- **SQLite**: Local file database (requires Disk for persistence)

## Checking Logs

In Render Dashboard:
1. Go to your service
2. Click "Logs" tab
3. Look for startup messages and errors

## Local Development vs Production

| Feature | Local | Production (Render) |
|---------|-------|---------------------|
| Frontend Dev Server | Vite (port 5173) | Built static files |
| Backend | Node (port 5000) | Node (port 10000) |
| Database | `backend/db.sqlite` | `/data/db.sqlite` (with Disk) |
| Firebase | Real or mock | Real |
| API URL | `http://localhost:5000` | Relative `/api` |
