# Render Deployment Guide

This guide will help you deploy the Legal Document Filler app to Render.

## Quick Deploy (Using render.yaml)

Render supports Blueprint deployments which will automatically set up both frontend and backend services.

### Step 1: Push to GitHub

1. Make sure your code is pushed to a GitHub repository
2. Note your repository URL

### Step 2: Deploy via Render Dashboard

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub repository
4. Render will automatically detect `render.yaml` and create both services
5. Add environment variables:
   - **Backend**: `OPENAI_API_KEY` (your OpenAI API key)
   - **Frontend**: Will automatically get `REACT_APP_API_BASE_URL` from backend service

### Step 3: Update CORS (After Deployment)

Once both services are deployed:

1. Go to your **Backend** service settings
2. Add environment variable:
   - **Key**: `RENDER_FRONTEND_URL`
   - **Value**: Your frontend URL (e.g., `https://legal-document-filler-frontend.onrender.com`)

## Manual Deployment (Alternative)

If you prefer to deploy services separately:

### Backend Deployment

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `legal-document-filler-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variable:
   - **Key**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key
6. Click **"Create Web Service"**

### Frontend Deployment

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Static Site"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `legal-document-filler-frontend`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `build`
5. Add environment variable:
   - **Key**: `REACT_APP_API_BASE_URL`
   - **Value**: Your backend URL (e.g., `https://legal-document-filler-backend.onrender.com`)
6. Click **"Create Static Site"**

### Update Backend CORS

After frontend is deployed, update backend environment variables:

1. Go to Backend service → **Environment** tab
2. Add:
   - **Key**: `RENDER_FRONTEND_URL`
   - **Value**: Your frontend URL (e.g., `https://legal-document-filler-frontend.onrender.com`)
3. Restart the backend service

## Environment Variables Summary

### Backend:
- `OPENAI_API_KEY` - Your OpenAI API key (required)
- `RENDER_FRONTEND_URL` - Frontend URL for CORS (required after frontend deployment)

### Frontend:
- `REACT_APP_API_BASE_URL` - Backend API URL (required)

## Testing

After deployment:
1. Frontend should be accessible at `https://your-frontend.onrender.com`
2. Backend should be accessible at `https://your-backend.onrender.com`
3. Test document upload and conversation flow

## Troubleshooting

- **CORS errors**: Make sure `RENDER_FRONTEND_URL` is set correctly in backend
- **API not found**: Check `REACT_APP_API_BASE_URL` matches your backend URL
- **Build failures**: Check Render logs for specific error messages
- **File upload errors**: Ensure backend has write permissions (temp files)

## Notes

- Render free tier services spin down after 15 minutes of inactivity
- First request after spin-down may take longer (cold start)
- Consider upgrading to paid plan for always-on services

