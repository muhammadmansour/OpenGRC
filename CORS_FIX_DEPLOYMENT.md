# 🔧 CORS Fix Deployment Guide

## ⚠️ Issue
The browser is showing **"Failed to fetch"** error because:
- Client-side JavaScript is making a request from `opengrc.wathbahs.com` → `muraji-api.wathbahs.com`
- This is a **Cross-Origin Request** that requires CORS headers
- The API needs to explicitly allow this

## ✅ What We Fixed

### 1. **Enhanced CORS Configuration** (`api/index.js`)
- Now allows all `*.wathbahs.com` subdomains
- Added explicit OPTIONS preflight handler
- More permissive headers and methods
- 24-hour cache for preflight requests

### 2. **Better Error Handling** (JavaScript)
- More detailed error messages
- Diagnostic information in console
- Explicit CORS mode in fetch()

### 3. **CORS Test Page** (`api/public/test-cors.html`)
- Simple HTML page to test if API is accessible
- Tests health, status, and evaluation endpoints
- Shows detailed error messages

---

## 🚀 Deployment Steps

### Step 1: Deploy Node.js API

```bash
# SSH to your server
ssh your-server

# Navigate to API directory
cd /var/www/muraji-api  # or wherever your API is

# Pull latest code
git pull origin main

# Install any new dependencies (if needed)
npm install

# Restart the API service
pm2 restart muraji-api

# Check logs
pm2 logs muraji-api --lines 50
```

### Step 2: Deploy Laravel Frontend

```bash
# Navigate to Laravel directory
cd /var/www/opengrc  # or wherever your Laravel app is

# Pull latest code
git pull origin main

# Clear all caches
php artisan view:clear
php artisan cache:clear
php artisan config:clear
php artisan route:clear

# Optimize (optional)
php artisan optimize
```

---

## 🧪 Testing Steps

### Test 1: API CORS Test Page

1. **Open in browser:**
   ```
   https://muraji-api.wathbahs.com/test-cors.html
   ```

2. **Click each button:**
   - ✅ **Test Health Check** - Should show green success
   - ✅ **Test Status Endpoint** - Should show Gemini status
   - ✅ **Test Full Evaluation** - Should return AI evaluation

3. **Expected Result:**
   - All three tests should show **green success messages**
   - If any fail, check the error message

### Test 2: From OpenGRC (Your App)

1. **Open the audit item page:**
   ```
   https://opengrc.wathbahs.com/app/audit-items/111/edit
   ```

2. **Open DevTools (F12):**
   - Go to **Console** tab
   - Go to **Network** tab

3. **Click "بدأ التحليل" button**

4. **Watch the Network tab:**
   - Look for request to `muraji-api.wathbahs.com/api/evaluations/audit-item`
   - Should show **status 200** (success)
   - Response should have evaluation data

5. **Watch the Console tab:**
   - Should see: 🚀 Starting Gemini Evaluation
   - Should see: 📡 API URL
   - Should see: 📥 Response Status: 200
   - Should see: ✅ Evaluation saved

---

## 🔍 Troubleshooting

### Problem 1: Still Getting "Failed to fetch"

**Possible Causes:**
- API server not running
- CORS still not configured properly
- Firewall blocking requests

**Solution:**
```bash
# Check if API is running
pm2 status

# Check API logs
pm2 logs muraji-api --lines 100

# Test API directly
curl -I https://muraji-api.wathbahs.com/health

# Test with CORS headers
curl -H "Origin: https://opengrc.wathbahs.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://muraji-api.wathbahs.com/api/evaluations/audit-item
```

### Problem 2: 404 Not Found

**Possible Causes:**
- Route not registered
- Nginx not forwarding requests

**Solution:**
```bash
# Check Nginx configuration
sudo nginx -t

# Check API routes
curl https://muraji-api.wathbahs.com/api/evaluations/status

# Restart Nginx
sudo systemctl restart nginx
```

### Problem 3: Network tab shows "CORS error"

**Possible Causes:**
- OPTIONS preflight request failed
- CORS headers missing

**Solution:**
Check the API response headers should include:
```
Access-Control-Allow-Origin: https://opengrc.wathbahs.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, userid
```

---

## 📊 Expected Behavior

### Before (Server-Side):
```
Browser → Laravel/PHP → Node.js API → Gemini
```
- ❌ API call NOT visible in Network tab
- ✅ No CORS issues
- ❌ Harder to debug

### After (Client-Side):
```
Browser JavaScript → Node.js API → Gemini
```
- ✅ API call VISIBLE in Network tab
- ⚠️ Requires CORS configuration
- ✅ Easy to debug

---

## 🎯 Success Criteria

✅ **Test page shows all green**
✅ **Network tab shows 200 status**
✅ **Console shows detailed logs**
✅ **Evaluation modal displays results**
✅ **AI score saved to database**

---

## 🆘 Still Not Working?

### Quick Diagnostic Commands:

```bash
# 1. Check if API is accessible
curl https://muraji-api.wathbahs.com/health

# 2. Check if CORS is working
curl -I -X OPTIONS \
  -H "Origin: https://opengrc.wathbahs.com" \
  -H "Access-Control-Request-Method: POST" \
  https://muraji-api.wathbahs.com/api/evaluations/status

# 3. Check PM2 status
pm2 status

# 4. Check API logs
pm2 logs muraji-api --lines 100 --raw

# 5. Test evaluation endpoint
curl -X POST https://muraji-api.wathbahs.com/api/evaluations/status
```

### Get Detailed Logs:

In the browser console, when you click "بدأ التحليل", you should see:
```javascript
🚀 Starting Gemini Evaluation: {title: "...", code: "...", ...}
📡 API URL: https://muraji-api.wathbahs.com/api/evaluations/audit-item
📥 Response Status: 200
📊 Response Data: {success: true, evaluation: {...}}
✅ Evaluation saved to database
```

If you see an error instead, it will show detailed diagnostic information.

---

## 📝 Files Changed

1. **`api/index.js`** - Enhanced CORS configuration
2. **`api/public/test-cors.html`** - New test page
3. **`resources/views/filament/components/gemini-evaluation-script.blade.php`** - Better error handling
4. **`app/Filament/Resources/AuditItemResource/Pages/EditAuditItem.php`** - Custom view

---

## 🔑 Environment Variables

Make sure these are set in `api/.env`:
```env
GEMINI_API_KEY=AIzaSyCshdvhF6ZW8t0XcpP-Pm_6Wj_IiEMNt0k
PORT=2020
NODE_ENV=production
CORS_ORIGINS=https://opengrc.wathbahs.com,https://muraji.wathbahs.com
```

And in Laravel `.env`:
```env
EVALUATION_API_URL=https://muraji-api.wathbahs.com
```

---

**Ready to deploy!** 🚀
