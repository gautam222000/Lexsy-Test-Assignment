# Render Deployment Guide

This guide will help you deploy the Legal Document Filler app to Render manually.

## Backend Deployment

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `legal-document-filler-backend` (or your preferred name)
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variable:
   - **Key**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key
6. Click **"Create Web Service"**
7. Wait for deployment to complete and note your backend URL (e.g., `https://legal-document-filler-backend.onrender.com`)

## Frontend Deployment

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Static Site"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `legal-document-filler-frontend` (or your preferred name)
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `build`
5. Add environment variable:
   - **Key**: `REACT_APP_API_BASE_URL`
   - **Value**: Your backend URL from step 7 above (e.g., `https://legal-document-filler-backend.onrender.com`)
6. Click **"Create Static Site"**
7. Wait for deployment to complete and note your frontend URL (e.g., `https://legal-document-filler-frontend.onrender.com`)

## Update Backend CORS

After frontend is deployed, update backend environment variables:

1. Go to Backend service → **Environment** tab
2. Add:
   - **Key**: `RENDER_FRONTEND_URL`
   - **Value**: Your frontend URL (e.g., `https://legal-document-filler-frontend.onrender.com`)
3. Save and restart the backend service

## Environment Variables Summary

### Backend:
- `OPENAI_API_KEY` - Your OpenAI API key (required)
- `RENDER_FRONTEND_URL` - Frontend URL for CORS (required after frontend deployment)

### Frontend:
- `REACT_APP_API_BASE_URL` - Backend API URL (required)

## Testing

After deployment:
1. Frontend should be accessible at your frontend URL
2. Backend should be accessible at your backend URL
3. Test document upload and conversation flow
4. Check browser console for any CORS or API errors

## Troubleshooting

- **CORS errors**: Make sure `RENDER_FRONTEND_URL` is set correctly in backend and matches your frontend URL exactly
- **API not found**: Check `REACT_APP_API_BASE_URL` matches your backend URL (including https://)
- **Build failures**: Check Render logs for specific error messages
- **File upload errors**: Ensure backend has write permissions (temp files)
- **Environment variables not working**: Make sure to rebuild/redeploy after adding environment variables

## Notes

- Render free tier services spin down after 15 minutes of inactivity
- First request after spin-down may take longer (cold start)
- Consider upgrading to paid plan for always-on services
- Make sure to deploy backend first, then frontend (since frontend needs backend URL)
