# Quick Deploy - Fix Duplicate chatRoutes

## Problem
```
SyntaxError: Identifier 'chatRoutes' has already been declared
```

## Solution
Fixed duplicate declarations in `api/index.js`:
- Removed duplicate `const chatRoutes = require('./routes/chat.routes');` (line 24)
- Removed duplicate `app.use('/api/chat', authMiddleware, chatRoutes);` (line 153)

---

## Deploy to Server

### 1. Update API Server
```bash
cd /var/www/muraji-api
git pull origin main
pm2 restart muraji-api
pm2 logs muraji-api --lines 50
```

### 2. Verify API is Running
```bash
# Check health
curl https://muraji-api.wathbahs.com/health

# Check chat status
curl https://muraji-api.wathbahs.com/api/chat/status
```

### 3. Update Frontend (Laravel)
```bash
cd /var/www/opengrc
git pull origin main
php artisan view:clear
php artisan cache:clear
php artisan config:clear
```

---

## Expected Result

✅ API should start without errors
✅ `/api/chat` endpoint is public (no auth required)
✅ Chat service is ready for use

---

## If Still Having Issues

### Check PM2 Status
```bash
pm2 status
pm2 describe muraji-api
```

### Check PM2 Logs
```bash
pm2 logs muraji-api --lines 100
```

### Restart PM2
```bash
pm2 restart muraji-api
```

### Check Node.js Version
```bash
node --version
# Should be >= 18.0.0
```

### Check Routes File Exists
```bash
ls -la /var/www/muraji-api/routes/chat.routes.js
```

---

## What Was Fixed

### Before (❌ Error):
```javascript
// Line 15
const chatRoutes = require('./routes/chat.routes');
// ... other imports ...
// Line 24 - DUPLICATE!
const chatRoutes = require('./routes/chat.routes');

// ...

// Line 149
app.use('/api/chat', chatRoutes);
// Line 153 - DUPLICATE!
app.use('/api/chat', authMiddleware, chatRoutes);
```

### After (✅ Fixed):
```javascript
// Line 15
const chatRoutes = require('./routes/chat.routes');
// ... other imports ...
// Line 24 - REMOVED

// ...

// Line 149
app.use('/api/chat', chatRoutes); // Public route only
// Line 153 - REMOVED
```

---

## Files Changed

- ✅ `api/index.js` - Fixed duplicate declarations
- ✅ All changes pushed to GitHub
