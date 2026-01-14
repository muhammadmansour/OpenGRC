# Quick Deployment Steps

The API at `https://muraji-api.wathbahs.com` needs to be updated with the new code.

## Option 1: Deploy via Git (Recommended)

```bash
# SSH to your server
ssh your-server

# Navigate to API directory
cd /var/www/muraji-api

# Pull latest changes
git pull origin main

# Install/update dependencies
npm install

# Restart the API server
pm2 restart muraji-api

# Check status
pm2 logs muraji-api --lines 50
```

## Option 2: Deploy Files Manually

```bash
# From your local machine in the api directory
cd api

# Upload to server
scp -r * your-server:/var/www/muraji-api/

# SSH to server
ssh your-server

# Install dependencies
cd /var/www/muraji-api
npm install

# Restart server
pm2 restart muraji-api
```

## Verify Deployment

After deployment, test the API:

```bash
# Test health (should work)
curl https://muraji-api.wathbahs.com/health

# Test evaluation status (should work now without auth)
curl https://muraji-api.wathbahs.com/api/evaluations/status

# Should return:
# {
#   "available": true/false,
#   "service": "Gemini AI Evaluation",
#   ...
# }
```

## Common Issues

### Issue: PM2 not found
```bash
sudo npm install -g pm2
```

### Issue: Port 2020 already in use
```bash
pm2 stop muraji-api
pm2 delete muraji-api
pm2 start index.js --name muraji-api
```

### Issue: Changes not reflecting
```bash
# Clear PM2 cache and restart
pm2 delete muraji-api
pm2 start index.js --name muraji-api
pm2 save
```

## What Changed

- ✅ Removed authentication requirement from `/api/evaluations/*` routes
- ✅ Fixed CORS to allow requests from your Laravel app
- ✅ Added logging for debugging

## Environment Variables Needed

Make sure your server has in `/var/www/muraji-api/.env`:

```env
PORT=2020
NODE_ENV=production
GEMINI_API_KEY=AIzaSyCshdvhF6ZW8t0XcpP-Pm_6Wj_IiEMNt0k
DB_HOST=34.1.36.28
DB_PORT=5432
DB_NAME=opengrc_db
DB_USER=opengrc
DB_PASSWORD=password123
CORS_ORIGINS=https://opengrc.wathbahs.com,http://localhost:9700
```

## Test from Laravel

After deployment, run:

```bash
php artisan test:gemini-api
```

All 3 tests should pass:
- ✓ Health check
- ✓ Status check  
- ✓ Quick analysis

Then try the "بدأ التحليل" button in your app!
