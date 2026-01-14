# Deployment Guide - muraji-api.wathbahs.com

## Overview

This guide explains how to deploy the Gemini AI Evaluation API to your production server at `https://muraji-api.wathbahs.com/`.

## Prerequisites

- ✅ Server with nginx installed (already done)
- ✅ Node.js 18+ installed
- ✅ PostgreSQL database running
- ✅ Domain pointing to server
- ✅ SSL certificate (Let's Encrypt recommended)

## Step 1: Upload Code to Server

```bash
# On your local machine
cd api
rsync -avz --exclude 'node_modules' ./ your-server:/var/www/muraji-api/

# Or use git
ssh your-server
cd /var/www/muraji-api
git pull origin main
```

## Step 2: Install Dependencies

```bash
ssh your-server
cd /var/www/muraji-api
npm install --production
```

## Step 3: Configure Environment Variables

```bash
# Create .env file on server
nano /var/www/muraji-api/.env
```

Add the following:

```env
# Server Configuration
PORT=2020
NODE_ENV=production

# Database Configuration (from your .env)
DB_HOST=34.1.36.28
DB_PORT=5432
DB_NAME=opengrc_db
DB_USER=opengrc
DB_PASSWORD=password123

# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# CORS Origins
CORS_ORIGINS=https://opengrc.wathbahs.com,https://muraji.wathbahs.com,https://wathbahs.com

# JWT Secret
JWT_SECRET=your_secure_jwt_secret_here
```

## Step 4: Configure Nginx

Create nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/muraji-api
```

Add this configuration:

```nginx
# /etc/nginx/sites-available/muraji-api

upstream nodejs_backend {
    server 127.0.0.1:2020;
    keepalive 64;
}

server {
    listen 80;
    server_name muraji-api.wathbahs.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name muraji-api.wathbahs.com;

    # SSL Configuration (adjust paths to your certificates)
    ssl_certificate /etc/letsencrypt/live/muraji-api.wathbahs.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/muraji-api.wathbahs.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Logging
    access_log /var/log/nginx/muraji-api-access.log;
    error_log /var/log/nginx/muraji-api-error.log;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=60r/m;
    limit_req zone=api_limit burst=10 nodelay;

    # Client body size (for file uploads)
    client_max_body_size 50M;

    # Proxy to Node.js application
    location / {
        proxy_pass http://nodejs_backend;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts (increased for AI processing)
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Cache bypass
        proxy_cache_bypass $http_upgrade;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://nodejs_backend/health;
        access_log off;
    }
}
```

Enable the site:

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/muraji-api /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## Step 5: Set Up SSL Certificate (if not already done)

Using Let's Encrypt:

```bash
# Install certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d muraji-api.wathbahs.com

# Auto-renewal is set up automatically
# Test renewal:
sudo certbot renew --dry-run
```

## Step 6: Set Up PM2 Process Manager

PM2 keeps your Node.js app running and auto-restarts on crashes:

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the application
cd /var/www/muraji-api
pm2 start index.js --name muraji-api

# Save PM2 configuration
pm2 save

# Set up PM2 to start on system boot
pm2 startup systemd
# Follow the instructions provided by the command above

# View logs
pm2 logs muraji-api

# Monitor application
pm2 monit

# Other useful PM2 commands:
# pm2 restart muraji-api     # Restart app
# pm2 stop muraji-api         # Stop app
# pm2 delete muraji-api       # Remove app from PM2
# pm2 list                    # List all apps
```

## Step 7: Configure PM2 Ecosystem File (Recommended)

Create a PM2 ecosystem file for better configuration:

```bash
nano /var/www/muraji-api/ecosystem.config.js
```

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'muraji-api',
    script: './index.js',
    instances: 2, // Use 2 CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 2020
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G',
    watch: false
  }]
};
```

Start with ecosystem file:

```bash
# Create logs directory
mkdir -p /var/www/muraji-api/logs

# Start with ecosystem file
pm2 start ecosystem.config.js

# Save configuration
pm2 save
```

## Step 8: Verify Deployment

Test the API:

```bash
# Check health endpoint
curl https://muraji-api.wathbahs.com/health

# Check API health
curl https://muraji-api.wathbahs.com/api/health

# Check evaluation status
curl https://muraji-api.wathbahs.com/api/evaluations/status

# View Swagger docs (in browser)
https://muraji-api.wathbahs.com/docs
```

## Step 9: Monitor and Maintain

### Check Application Status

```bash
# PM2 status
pm2 status

# View logs
pm2 logs muraji-api --lines 100

# Monitor resources
pm2 monit
```

### Check Nginx Status

```bash
# Status
sudo systemctl status nginx

# View error logs
sudo tail -f /var/log/nginx/muraji-api-error.log

# View access logs
sudo tail -f /var/log/nginx/muraji-api-access.log
```

### Database Connection

Test PostgreSQL connection:

```bash
cd /var/www/muraji-api
node -e "
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('DB Error:', err);
  else console.log('DB Connected:', res.rows[0]);
  pool.end();
});
"
```

## Updating the Application

```bash
# SSH to server
ssh your-server

# Navigate to directory
cd /var/www/muraji-api

# Pull latest changes
git pull origin main

# Install new dependencies
npm install --production

# Restart application
pm2 restart muraji-api

# Check status
pm2 status
pm2 logs muraji-api --lines 50
```

## Troubleshooting

### Issue: API returns 502 Bad Gateway

**Cause**: Node.js app not running

**Solution**:
```bash
pm2 status
pm2 logs muraji-api
pm2 restart muraji-api
```

### Issue: API returns 503 Service Unavailable

**Cause**: Gemini API key not configured

**Solution**:
```bash
nano /var/www/muraji-api/.env
# Add: GEMINI_API_KEY=your_key_here
pm2 restart muraji-api
```

### Issue: Database connection failed

**Cause**: PostgreSQL not accessible from server

**Solution**:
```bash
# Test connection
psql -h 34.1.36.28 -p 5432 -U opengrc -d opengrc_db

# Check firewall rules on database server
# Ensure 34.1.36.28 allows connections from your API server IP
```

### Issue: CORS errors

**Cause**: Frontend domain not in CORS_ORIGINS

**Solution**:
```bash
nano /var/www/muraji-api/.env
# Update CORS_ORIGINS to include your frontend domain
pm2 restart muraji-api
```

## Security Checklist

- ✅ SSL/TLS certificate installed and auto-renewing
- ✅ Firewall configured (allow only 80, 443, 22)
- ✅ Rate limiting enabled in nginx
- ✅ Environment variables secured (not in git)
- ✅ Database password strong and secured
- ✅ Gemini API key secured
- ✅ PM2 running as non-root user
- ✅ Regular security updates scheduled
- ✅ Logs being monitored

## Performance Optimization

### Enable Nginx Caching (Optional)

```nginx
# Add to nginx config
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=60m;

location /api/ {
    proxy_cache api_cache;
    proxy_cache_valid 200 10m;
    proxy_cache_bypass $http_cache_control;
    add_header X-Cache-Status $upstream_cache_status;
    # ... rest of proxy config
}
```

### Enable Compression

```nginx
# Add to nginx server block
gzip on;
gzip_vary on;
gzip_min_length 256;
gzip_types application/json text/plain text/css application/javascript;
```

## Backup Strategy

### Application Code
```bash
# Git is your backup - commit and push regularly
```

### Database Backups
```bash
# Backup script (run daily via cron)
#!/bin/bash
BACKUP_DIR="/var/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
pg_dump -h 34.1.36.28 -U opengrc opengrc_db > $BACKUP_DIR/backup_$DATE.sql
# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
```

### Environment Variables
```bash
# Backup .env file securely
cp /var/www/muraji-api/.env /secure/backup/location/.env.backup
```

## API Endpoints (Production)

Base URL: `https://muraji-api.wathbahs.com`

- 🔍 Health: `GET /health`
- 🔍 API Health: `GET /api/health`
- 📚 Docs: `GET /docs`
- 🤖 Evaluation Status: `GET /api/evaluations/status`
- 🤖 Evaluate Item: `POST /api/evaluations/audit-item`
- 🤖 Batch Evaluate: `POST /api/evaluations/batch`
- 🤖 Quick Analysis: `POST /api/evaluations/quick-analysis`
- 🤖 Recommendations: `POST /api/evaluations/recommendations`

## Support

- **Logs**: `pm2 logs muraji-api`
- **Status**: `pm2 status`
- **Restart**: `pm2 restart muraji-api`
- **Monitor**: `pm2 monit`

---

**Production URL**: https://muraji-api.wathbahs.com  
**Documentation**: https://muraji-api.wathbahs.com/docs
