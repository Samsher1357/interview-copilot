# Quick Deployment Guide

## 🚀 Deploy in 10 Minutes

### 1️⃣ Deploy Backend to Railway (5 min)

1. Go to https://railway.app/dashboard
2. Click "New Project" → "Deploy from GitHub repo"
3. Select `interview-copilot-vercel` repository
4. In Settings:
   - Root Directory: `backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start`
5. Go to Variables tab, copy from `backend/.env.railway` and set:
   - PORT=3001
   - NODE_ENV=production
   - OPENAI_API_KEY=sk-...
   - DEEPGRAM_API_KEY=...
   - CORS_ORIGIN=https://your-vercel-url.vercel.app (update later)
6. Generate Domain in Settings → Networking
7. **Copy your Railway URL** (e.g., https://your-app.up.railway.app)

### 2️⃣ Deploy Frontend to Vercel (3 min)

1. Go to https://vercel.com/dashboard
2. Click "Add New Project" → Import Git Repository
3. Select `interview-copilot-vercel`
4. Vercel auto-detects Next.js (no config needed)
5. Add Environment Variable:
   - Key: `NEXT_PUBLIC_API_URL`
   - Value: Your Railway URL from Step 1.7
6. Click "Deploy"
7. **Copy your Vercel URL** after deployment

### 3️⃣ Update Backend CORS (1 min)

1. Go back to Railway → Your Project → Variables
2. Update `CORS_ORIGIN` with your Vercel URL from Step 2.7
3. Railway auto-redeploys

### 4️⃣ Test (1 min)

1. Open your Vercel URL in browser
2. Grant microphone permission
3. Start listening
4. Speak and verify:
   - ✅ Transcription appears
   - ✅ AI responses generate
   - ✅ No CORS errors in console (F12)

## ✅ You're Done!

Frontend: https://your-app.vercel.app
Backend: https://your-backend.railway.app

---

## 📝 Checklist

- [ ] Railway backend deployed
- [ ] Railway domain generated
- [ ] Railway environment variables set
- [ ] Vercel frontend deployed
- [ ] Vercel NEXT_PUBLIC_API_URL set to Railway URL
- [ ] Railway CORS_ORIGIN set to Vercel URL
- [ ] Tested in browser - everything works

---

## 🆘 Issues?

**CORS Error?**
- Check Railway CORS_ORIGIN matches Vercel URL exactly
- No trailing slash
- Include https://

**Backend not responding?**
- Check Railway logs (Deployments → View Logs)
- Test health check: https://your-backend.railway.app/health

**Build failed?**
- Check build logs in Railway/Vercel dashboard
- Verify all dependencies in package.json

---

See full guide: DEPLOYMENT.md
