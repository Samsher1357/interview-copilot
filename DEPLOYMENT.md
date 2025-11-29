# Deployment Guide - Interview Copilot

This guide covers deploying the Interview Copilot application using a hybrid approach:
- **Frontend (Next.js)** → Vercel
- **Backend (Express + Socket.IO)** → Railway

## 📋 Prerequisites

- GitHub account with your repository
- [Vercel account](https://vercel.com/signup)
- [Railway account](https://railway.app/)
- API Keys:
  - OpenAI or Google Gemini API key
  - Deepgram API key

---

## 🚂 Part 1: Deploy Backend to Railway

### Step 1: Install Railway CLI (Optional)

```bash
npm i -g @railway/cli
```

### Step 2: Deploy via Railway Dashboard (Recommended)

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository: `interview-copilot-vercel`
5. Railway will detect your configuration automatically

### Step 3: Configure Railway Settings

1. In Railway project settings:
   - **Root Directory**: Set to `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Health Check Path**: `/health`

### Step 4: Set Environment Variables in Railway

Go to your Railway project → **Variables** tab and add:

```env
PORT=3001
NODE_ENV=production

# CORS - Update after deploying frontend
CORS_ORIGIN=https://your-frontend.vercel.app

# AI Provider (choose one)
AI_PROVIDER=openai
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini

# OR use Gemini (FREE)
# AI_PROVIDER=gemini
# GOOGLE_API_KEY=xxxxxxxxxxxxx
# GEMINI_MODEL=gemini-1.5-flash

AI_MAX_TOKENS=1200

# Deepgram (Required)
DEEPGRAM_API_KEY=xxxxxxxxxxxxx
```

### Step 5: Deploy

Railway will automatically deploy. Wait for deployment to complete.

### Step 6: Get Your Backend URL

1. Go to **Settings** → **Networking**
2. Click **Generate Domain**
3. Copy your backend URL (e.g., `https://your-app.up.railway.app`)
4. Save this URL - you'll need it for Vercel

### Alternative: Deploy via CLI

```bash
# Navigate to backend directory
cd backend

# Login to Railway
railway login

# Initialize project
railway init

# Link to your project (if already created)
railway link

# Deploy
railway up

# Set environment variables
railway variables set PORT=3001
railway variables set NODE_ENV=production
railway variables set OPENAI_API_KEY=sk-xxxxx
# ... add other variables
```

---

## ▲ Part 2: Deploy Frontend to Vercel

### Step 1: Install Vercel CLI (Optional)

```bash
npm i -g vercel
```

### Step 2: Deploy via Vercel Dashboard (Recommended)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Import your GitHub repository: `interview-copilot-vercel`
4. Vercel will detect Next.js automatically

### Step 3: Configure Build Settings

Vercel should auto-detect from `vercel.json`, but verify:

- **Framework Preset**: Next.js
- **Root Directory**: Leave empty (will use `frontend` via vercel.json)
- **Build Command**: `cd frontend && npm run build`
- **Output Directory**: `frontend/.next`
- **Install Command**: `cd frontend && npm install`

### Step 4: Set Environment Variables in Vercel

In the deployment settings, add:

```env
NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
```

**Important**: Replace `your-backend.up.railway.app` with your actual Railway backend URL from Part 1, Step 6.

### Step 5: Deploy

Click **"Deploy"** and wait for deployment to complete.

### Step 6: Get Your Frontend URL

After deployment completes, copy your Vercel URL (e.g., `https://interview-copilot-vercel.vercel.app`)

### Step 7: Update Backend CORS

Go back to Railway → Variables and update:

```env
CORS_ORIGIN=https://interview-copilot-vercel.vercel.app
```

Replace with your actual Vercel URL. Railway will automatically redeploy.

### Alternative: Deploy via CLI

```bash
# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod

# Set environment variables
vercel env add NEXT_PUBLIC_API_URL production
# Enter your Railway backend URL when prompted
```

---

## 🔄 Update Environment Variables

### After Both Deployments

1. **Update Railway CORS_ORIGIN**:
   - Go to Railway → Variables
   - Set `CORS_ORIGIN` to your Vercel URL
   - Railway will auto-redeploy

2. **Verify Vercel Variables**:
   - Go to Vercel → Settings → Environment Variables
   - Ensure `NEXT_PUBLIC_API_URL` points to Railway backend

3. **Test the Connection**:
   - Open your Vercel URL in browser
   - Open browser console (F12)
   - Check for CORS errors or connection issues

---

## ✅ Verification Checklist

### Backend (Railway)

- [ ] Backend is deployed and running
- [ ] Health check endpoint works: `https://your-backend.railway.app/health`
- [ ] Environment variables are set correctly
- [ ] CORS_ORIGIN matches your Vercel URL
- [ ] Logs show no errors

### Frontend (Vercel)

- [ ] Frontend is deployed successfully
- [ ] NEXT_PUBLIC_API_URL points to Railway backend
- [ ] Application loads in browser
- [ ] No CORS errors in browser console
- [ ] Can connect to backend API

### Full System Test

- [ ] Open the application in browser
- [ ] Configure context and start listening
- [ ] Microphone access works
- [ ] Transcription appears
- [ ] AI responses are generated
- [ ] Real-time updates work via Socket.IO

---

## 🔧 Troubleshooting

### CORS Errors

**Problem**: "Access to fetch at '...' from origin '...' has been blocked by CORS policy"

**Solution**:
1. Verify `CORS_ORIGIN` in Railway matches your Vercel URL exactly
2. Include the protocol (https://)
3. Don't include trailing slash
4. Wait for Railway to redeploy after changing

### Backend Not Responding

**Problem**: Frontend can't connect to backend

**Solution**:
1. Check Railway logs for errors
2. Verify backend URL in Vercel environment variables
3. Test health endpoint directly: `https://your-backend.railway.app/health`
4. Check Railway service status

### WebSocket Connection Fails

**Problem**: "WebSocket connection failed" in browser console

**Solution**:
1. Railway supports WebSockets by default
2. Check if backend is running (Railway logs)
3. Verify Socket.IO client is connecting to correct URL
4. Check for firewall/proxy issues

### Build Failures

**Frontend Build Fails**:
- Check Vercel build logs
- Ensure all dependencies in `frontend/package.json`
- Verify TypeScript types are correct

**Backend Build Fails**:
- Check Railway build logs
- Ensure all dependencies in `backend/package.json`
- Verify TypeScript compilation succeeds

### Environment Variables Not Working

**Solution**:
1. Redeploy after adding new variables
2. For Vercel: Redeploy from dashboard
3. For Railway: Variables trigger auto-deploy
4. Check variable names match exactly (case-sensitive)

---

## 💰 Cost Estimates

### Vercel (Frontend)
- **Hobby Plan (Free)**:
  - 100 GB bandwidth/month
  - Unlimited deployments
  - Perfect for personal projects

- **Pro Plan ($20/month)**:
  - Unlimited bandwidth
  - Team collaboration
  - Advanced analytics

### Railway (Backend)
- **Free Trial**: $5 credit (good for ~500 hours)
- **Developer Plan**: Pay-as-you-go
  - ~$5-10/month for small apps
  - $0.000463/GB-hour memory
  - $0.000231/vCPU-hour

**Total**: Free tier available, ~$5-20/month for production

---

## 🔒 Security Best Practices

1. **Never commit API keys**:
   - Use environment variables only
   - Add `.env*` to `.gitignore`

2. **Set strict CORS**:
   - Only allow your Vercel domain
   - Don't use wildcard (*) in production

3. **Rate Limiting**:
   - Backend already has rate limiting middleware
   - Monitor Railway logs for abuse

4. **API Key Security**:
   - All API keys in backend only
   - Never expose in frontend

5. **HTTPS Only**:
   - Both Vercel and Railway provide HTTPS by default
   - Never allow HTTP in production

---

## 📊 Monitoring

### Railway Monitoring
- Go to your project → **Observability**
- View CPU, memory, network usage
- Check logs for errors
- Set up alerts for downtime

### Vercel Analytics
- Go to your project → **Analytics**
- View page views, performance
- Check function execution
- Monitor build times

---

## 🔄 CI/CD Setup

Both platforms support automatic deployments:

### Vercel
- Auto-deploys on push to `main` branch
- Preview deployments for pull requests
- Configure in Settings → Git

### Railway
- Auto-deploys on push to `main` branch
- Can configure deploy triggers
- Set up in Settings → Deployments

---

## 📝 Custom Domains (Optional)

### Vercel Custom Domain
1. Go to Project Settings → Domains
2. Add your domain (e.g., `interview-copilot.com`)
3. Configure DNS records as instructed
4. SSL certificate auto-provisioned

### Railway Custom Domain
1. Go to Project Settings → Networking
2. Add custom domain (e.g., `api.interview-copilot.com`)
3. Configure DNS CNAME record
4. Update `CORS_ORIGIN` in Railway
5. Update `NEXT_PUBLIC_API_URL` in Vercel

---

## 🚀 Quick Start Commands

### Deploy Everything

```bash
# 1. Deploy backend to Railway
cd backend
railway up

# 2. Deploy frontend to Vercel
cd ../
vercel --prod

# 3. Update environment variables (via dashboards)
```

### Local Development

```bash
# Run locally before deploying
npm run dev

# Build locally to test
npm run build

# Start production build locally
npm run start
```

---

## 📚 Additional Resources

- [Railway Documentation](https://docs.railway.app/)
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Socket.IO Documentation](https://socket.io/docs/)

---

## 🆘 Support

If you encounter issues:

1. Check Railway logs: Project → Deployments → View Logs
2. Check Vercel logs: Project → Deployments → Function Logs
3. Check browser console for frontend errors
4. Review environment variables match this guide

---

**Deployment Status**: ✅ Ready for production deployment
