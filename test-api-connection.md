# 🔍 API Connection Diagnostic

## Current Status:
- ✅ JavaScript is executing (good!)
- ✅ Fetch is being called (good!)
- ❌ Cannot reach API server (needs fixing)

## Problem:
The API might be running on `localhost:2020` but not accessible via `https://muraji-api.wathbahs.com`

---

## 🧪 Test 1: Check if API is Publicly Accessible

**From YOUR computer (not server), open in browser:**

1. Test Health Endpoint:
   ```
   https://muraji-api.wathbahs.com/health
   ```
   **Expected:** `{"status":"ok",...}`
   
   **If you get an error**, the API is NOT publicly accessible.

2. Test Status Endpoint:
   ```
   https://muraji-api.wathbahs.com/api/evaluations/status
   ```
   **Expected:** JSON with Gemini status

---

## 🔧 Fix 1: Check Nginx Configuration

The API is running on `localhost:2020` but you need Nginx to proxy it.

### Check Nginx Config:

```bash
# SSH to your server
cd /etc/nginx/sites-available/

# Check if muraji-api config exists
ls -la | grep muraji

# View the config
cat muraji-api  # or whatever the file is named
```

### Expected Nginx Config:

```nginx
server {
    listen 80;
    listen 443 ssl;
    server_name muraji-api.wathbahs.com;

    # SSL Certificate
    ssl_certificate /etc/letsencrypt/live/muraji-api.wathbahs.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/muraji-api.wathbahs.com/privkey.pem;

    # Proxy to Node.js API
    location / {
        proxy_pass http://localhost:2020;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🔧 Fix 2: Create/Update Nginx Config

If the config doesn't exist or is wrong:

```bash
# Create/edit Nginx config
sudo nano /etc/nginx/sites-available/muraji-api

# Paste the config from above

# Create symlink
sudo ln -sf /etc/nginx/sites-available/muraji-api /etc/nginx/sites-enabled/

# Test Nginx config
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

---

## 🔧 Fix 3: Check DNS

```bash
# Check if domain resolves
nslookup muraji-api.wathbahs.com

# Or use dig
dig muraji-api.wathbahs.com

# Should return your server's IP address
```

If DNS doesn't resolve, you need to add an A record in your domain registrar:
```
Type: A
Name: muraji-api
Value: [YOUR_SERVER_IP]
TTL: 300
```

---

## 🔧 Fix 4: Check Firewall

```bash
# Check if port 80 and 443 are open
sudo ufw status

# If needed, allow them
sudo ufw allow 80
sudo ufw allow 443
```

---

## 🔧 Fix 5: SSL Certificate

If using Let's Encrypt:

```bash
# Install certbot if not installed
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d muraji-api.wathbahs.com

# Test renewal
sudo certbot renew --dry-run
```

---

## 📊 Quick Diagnostic Commands

Run these on your **server**:

```bash
# 1. Check if API is running locally
curl http://localhost:2020/health

# 2. Check PM2 status
pm2 status

# 3. Check PM2 logs
pm2 logs muraji-api --lines 50

# 4. Check Nginx status
sudo systemctl status nginx

# 5. Check Nginx error logs
sudo tail -50 /var/log/nginx/error.log

# 6. Check if port 2020 is listening
netstat -tuln | grep 2020

# 7. Test Nginx proxy locally
curl http://localhost:80/health -H "Host: muraji-api.wathbahs.com"

# 8. Test externally
curl https://muraji-api.wathbahs.com/health
```

---

## 🎯 Most Likely Issue:

Based on your setup, the most likely issues are:

1. **Nginx not configured** - API running on localhost:2020 but not exposed
2. **DNS not configured** - Domain doesn't point to your server
3. **SSL certificate missing** - HTTPS not working

---

## 🆘 Quick Fix (Temporary):

If you want to test it quickly, you can temporarily use HTTP instead of HTTPS:

### Update Laravel Config:

```php
// config/services.php
'evaluation_api' => [
    'url' => env('EVALUATION_API_URL', 'http://YOUR_SERVER_IP:2020'),
],
```

Then test with: `http://YOUR_SERVER_IP:2020/health`

**But this is NOT recommended for production!**

---

## ✅ What to Send Me:

Please run these and send me the output:

```bash
# 1. Test API locally
curl http://localhost:2020/health

# 2. Check Nginx sites
ls -la /etc/nginx/sites-enabled/

# 3. Check if domain resolves
nslookup muraji-api.wathbahs.com

# 4. PM2 status
pm2 list
```

This will help me see exactly what's wrong!
