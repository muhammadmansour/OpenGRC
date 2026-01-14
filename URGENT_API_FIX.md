# 🆘 URGENT: API Connection Fix

## Current Issue:
Browser shows: "Cannot reach API server at https://muraji-api.wathbahs.com/api/evaluations/audit-item"

But your previous screenshot showed:
- ✅ API server running on port 2020
- ✅ 200 OK responses from muraji-api.wathbahs.com

This means either:
1. API stopped running
2. Nginx isn't proxying correctly
3. DNS/SSL issue

---

## 🔍 STEP 1: Test from Browser (Quick Check)

**Open these URLs directly in your browser:**

### Test 1: Health Check
```
https://muraji-api.wathbahs.com/health
```
**Expected:** `{"status":"ok","timestamp":"...","version":"1.0.0"}`

**If you get an error** → API is not accessible publicly

### Test 2: Status Check
```
https://muraji-api.wathbahs.com/api/evaluations/status
```
**Expected:** JSON with Gemini AI status

---

## 🔧 STEP 2: Server Diagnostics (SSH)

**Run these commands on your server:**

```bash
# 1. Check if API is running
pm2 list
# Look for "muraji-api" - should show "online"

# 2. If not running, check logs
pm2 logs muraji-api --lines 50

# 3. If not in PM2, start it
cd /var/www/muraji-api
pm2 start index.js --name muraji-api

# 4. Test API locally on server
curl http://localhost:2020/health
# Should return: {"status":"ok",...}

# 5. Check Nginx configuration
sudo nginx -t
# Should say "syntax is ok"

# 6. Check if Nginx site is enabled
ls -la /etc/nginx/sites-enabled/ | grep muraji

# 7. View Nginx config
cat /etc/nginx/sites-available/muraji-api
# OR
cat /etc/nginx/sites-enabled/muraji-api

# 8. Check Nginx error logs
sudo tail -50 /var/log/nginx/error.log

# 9. Restart Nginx
sudo systemctl restart nginx

# 10. Test externally
curl https://muraji-api.wathbahs.com/health
```

---

## 🚨 MOST LIKELY ISSUE: Nginx Not Configured

If `https://muraji-api.wathbahs.com/health` doesn't work in your browser, Nginx is NOT configured.

### Fix: Create Nginx Configuration

```bash
# 1. Create Nginx config
sudo nano /etc/nginx/sites-available/muraji-api
```

**Paste this EXACT config:**

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name muraji-api.wathbahs.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name muraji-api.wathbahs.com;

    # SSL Configuration (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/muraji-api.wathbahs.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/muraji-api.wathbahs.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Logs
    access_log /var/log/nginx/muraji-api.access.log;
    error_log /var/log/nginx/muraji-api.error.log;

    # Proxy to Node.js API on port 2020
    location / {
        proxy_pass http://127.0.0.1:2020;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Cache
        proxy_cache_bypass $http_upgrade;
        
        # Buffer settings
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Health check endpoint (no caching)
    location /health {
        proxy_pass http://127.0.0.1:2020/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
```

**Save and exit:** Press `Ctrl+X`, then `Y`, then `Enter`

```bash
# 2. Enable the site
sudo ln -sf /etc/nginx/sites-available/muraji-api /etc/nginx/sites-enabled/

# 3. Remove default if it conflicts
sudo rm -f /etc/nginx/sites-enabled/default

# 4. Test Nginx configuration
sudo nginx -t

# 5. If test passes, restart Nginx
sudo systemctl restart nginx

# 6. Check status
sudo systemctl status nginx
```

---

## 🔒 STEP 3: Setup SSL Certificate

If SSL certificates don't exist:

```bash
# 1. Install certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# 2. Get SSL certificate
sudo certbot --nginx -d muraji-api.wathbahs.com

# Follow prompts:
# - Enter email
# - Agree to terms
# - Choose redirect HTTP to HTTPS (recommended)

# 3. Test auto-renewal
sudo certbot renew --dry-run
```

---

## 🌐 STEP 4: Check DNS

```bash
# Check if domain resolves to your server
nslookup muraji-api.wathbahs.com

# Or use dig
dig muraji-api.wathbahs.com +short
```

**Expected:** Your server's IP address

**If DNS doesn't resolve:**
1. Go to your domain registrar (GoDaddy, Cloudflare, etc.)
2. Add A record:
   - Type: `A`
   - Name: `muraji-api`
   - Value: `YOUR_SERVER_IP`
   - TTL: `300` (5 minutes)
3. Wait 5-10 minutes for DNS propagation

---

## ⚡ TEMPORARY FIX: Use Server IP

If you want to test immediately without DNS/SSL:

### Option A: Use HTTP + IP (NOT for production!)

```bash
# On Laravel server
cd /var/www/opengrc

# Update .env
nano .env
```

**Change:**
```env
EVALUATION_API_URL=http://YOUR_SERVER_IP:2020
```

**Then:**
```bash
php artisan config:clear
php artisan cache:clear
```

**In browser, test:**
```
http://YOUR_SERVER_IP:2020/health
```

---

## 📊 Expected Results After Fix:

### Test 1: Browser URL
```
https://muraji-api.wathbahs.com/health
```
**Should show:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-14T...",
  "version": "1.0.0"
}
```

### Test 2: From OpenGRC
```
https://opengrc.wathbahs.com/app/audit-items/111/edit
```
1. Click "بدأ التحليل"
2. Network tab shows 200 OK
3. Success notification appears

---

## 🆘 Quick Command Summary

**Copy and paste this entire block:**

```bash
# Check API
pm2 list
curl http://localhost:2020/health

# Check Nginx
sudo nginx -t
ls -la /etc/nginx/sites-enabled/

# Check if site config exists
cat /etc/nginx/sites-enabled/muraji-api 2>/dev/null || echo "NOT CONFIGURED"

# Test external access
curl https://muraji-api.wathbahs.com/health

# If API not running
cd /var/www/muraji-api
pm2 start index.js --name muraji-api || pm2 restart muraji-api
```

---

## 📝 Send Me These Outputs:

Please run and send me the output of:

```bash
# 1. PM2 status
pm2 list

# 2. Local API test
curl http://localhost:2020/health

# 3. Nginx sites
ls -la /etc/nginx/sites-enabled/

# 4. External test
curl -I https://muraji-api.wathbahs.com/health

# 5. DNS check
nslookup muraji-api.wathbahs.com
```

This will show me exactly what's configured and what's missing!
