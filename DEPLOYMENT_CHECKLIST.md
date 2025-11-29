# Deployment Checklist

Use this checklist to track your deployment progress.

## Pre-Deployment Setup

- [ ] API keys obtained:
  - [ ] OpenAI API key (or Google Gemini API key)
  - [ ] Deepgram API key
- [ ] Accounts created:
  - [ ] Railway account
  - [ ] Vercel account
- [ ] Repository pushed to GitHub
  - [ ] All code committed
  - [ ] `.env.local` NOT committed (should be in .gitignore)

---

## Backend Deployment (Railway)

### Setup
- [ ] Created new Railway project
- [ ] Connected GitHub repository
- [ ] Set root directory to `backend`
- [ ] Build command configured: `npm install && npm run build`
- [ ] Start command configured: `npm run start`

### Environment Variables
Set these in Railway → Variables:
- [ ] `PORT` = `3001`
- [ ] `NODE_ENV` = `production`
- [ ] `AI_PROVIDER` = `openai` (or `gemini`)
- [ ] `OPENAI_API_KEY` = `sk-...` (if using OpenAI)
- [ ] `GOOGLE_API_KEY` = `...` (if using Gemini)
- [ ] `OPENAI_MODEL` or `GEMINI_MODEL`
- [ ] `AI_MAX_TOKENS` = `1200`
- [ ] `DEEPGRAM_API_KEY` = `...`
- [ ] `CORS_ORIGIN` = (will update after Vercel deployment)

### Deployment
- [ ] Backend deployed successfully
- [ ] Generated custom domain in Railway
- [ ] Copied Railway backend URL: ___________________________________
- [ ] Health check works: `https://your-backend.railway.app/health`
- [ ] Checked logs for errors

---

## Frontend Deployment (Vercel)

### Setup
- [ ] Created new Vercel project
- [ ] Imported GitHub repository
- [ ] Framework detected as Next.js
- [ ] Build settings verified (auto-detected from vercel.json)

### Environment Variables
Set these in Vercel → Settings → Environment Variables:
- [ ] `NEXT_PUBLIC_API_URL` = Your Railway backend URL

### Deployment
- [ ] Frontend deployed successfully
- [ ] Copied Vercel frontend URL: ___________________________________
- [ ] Application loads in browser
- [ ] No build errors

---

## Post-Deployment Configuration

### Update CORS
- [ ] Went back to Railway → Variables
- [ ] Updated `CORS_ORIGIN` with Vercel frontend URL
- [ ] Railway auto-redeployed
- [ ] Verified deployment completed

---

## Testing

### Basic Functionality
- [ ] Opened application in browser: _________________________________
- [ ] No JavaScript errors in console (F12)
- [ ] No CORS errors in console
- [ ] Application UI loads correctly

### Microphone & Transcription
- [ ] Clicked "Start Listening"
- [ ] Browser requested microphone permission
- [ ] Granted microphone permission
- [ ] Spoke some words
- [ ] Transcription appeared in transcript panel
- [ ] Speaker identification working (Interviewer/Applicant)

### AI Analysis
- [ ] Transcription triggered AI analysis
- [ ] AI response appeared in response panel
- [ ] Response was relevant to transcription
- [ ] No API errors in console

### Real-time WebSocket
- [ ] Opened browser console → Network → WS tab
- [ ] WebSocket connection established to backend
- [ ] No WebSocket connection errors
- [ ] Real-time updates working

### Full Conversation Test
- [ ] Simulated interviewer question (spoke as interviewer)
- [ ] Received answer suggestions
- [ ] Simulated applicant answer (spoke as applicant)
- [ ] Received feedback on answer
- [ ] Context awareness working

---

## Optional Enhancements

### Custom Domains
- [ ] Added custom domain to Vercel
- [ ] Added custom domain to Railway
- [ ] Updated CORS_ORIGIN with new domain
- [ ] Updated NEXT_PUBLIC_API_URL with new domain
- [ ] SSL certificates provisioned

### Monitoring
- [ ] Set up Railway alerts for downtime
- [ ] Enabled Vercel analytics
- [ ] Bookmarked Railway logs URL
- [ ] Bookmarked Vercel deployment logs

### CI/CD
- [ ] Verified auto-deploy on push to main branch (Railway)
- [ ] Verified auto-deploy on push to main branch (Vercel)
- [ ] Tested by making a small change and pushing

---

## Deployment URLs

Record your deployment URLs here for easy reference:

**Backend (Railway):**
- URL: ___________________________________________________
- Health Check: ___________________________________________
- Dashboard: https://railway.app/project/[your-project-id]

**Frontend (Vercel):**
- URL: ___________________________________________________
- Dashboard: https://vercel.com/[your-username]/interview-copilot-vercel

---

## Troubleshooting Log

If you encounter issues, document them here:

**Issue 1:**
- Description: 
- Solution: 
- Date: 

**Issue 2:**
- Description: 
- Solution: 
- Date: 

---

## ✅ Deployment Complete!

Once all checkboxes are checked, your application is fully deployed and ready for production use!

**Next Steps:**
- Share the URL with users
- Monitor Railway and Vercel dashboards for usage
- Check logs periodically for errors
- Update environment variables if API keys change

**Cost Monitoring:**
- Railway: Check usage in dashboard (free $5 credit)
- Vercel: Monitor bandwidth usage (free 100 GB/month)
