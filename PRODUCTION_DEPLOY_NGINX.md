# OpenGRC Production Deployment with Nginx (Without Docker)

This guide covers deploying OpenGRC Laravel application directly on a Linux server with Nginx.

## Prerequisites

- Ubuntu 22.04 LTS (or similar)
- Root/sudo access
- Domain name pointing to your server

---

## Step 1: Install Required Software

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Nginx
sudo apt install nginx -y

# Install PHP 8.2 and required extensions
sudo add-apt-repository ppa:ondrej/php -y
sudo apt update
sudo apt install php8.2 php8.2-fpm php8.2-cli php8.2-common php8.2-mysql php8.2-pgsql \
    php8.2-zip php8.2-gd php8.2-mbstring php8.2-curl php8.2-xml php8.2-bcmath \
    php8.2-intl php8.2-readline php8.2-redis php8.2-sqlite3 -y

# Install Composer
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y

# Install PostgreSQL (if using locally)
sudo apt install postgresql postgresql-contrib -y

# Install Redis (optional, for caching/queues)
sudo apt install redis-server -y
```

---

## Step 2: Configure PostgreSQL Database

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE opengrc_db;
CREATE USER opengrc WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE opengrc_db TO opengrc;
ALTER DATABASE opengrc_db OWNER TO opengrc;
\q
```

---

## Step 3: Deploy OpenGRC Application

```bash
# Create web directory
sudo mkdir -p /var/www/opengrc
sudo chown -R $USER:$USER /var/www/opengrc

# Clone repository
cd /var/www/opengrc
git clone https://github.com/muhammadmansour/OpenGRC.git .

# Or upload your code
# rsync -avz --exclude 'node_modules' --exclude 'vendor' ./ user@server:/var/www/opengrc/

# Install PHP dependencies
composer install --optimize-autoloader --no-dev

# Install Node dependencies and build assets
npm ci
npm run build

# Clean up node_modules after build (optional, saves space)
rm -rf node_modules
```

---

## Step 4: Configure Environment

```bash
# Copy environment file
cp .env.example .env

# Edit environment file
nano .env
```

**Update these values in `.env`:**

```env
APP_NAME=OpenGRC
APP_ENV=production
APP_DEBUG=false
APP_URL=https://opengrc.yourdomain.com

# Database
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=opengrc_db
DB_USERNAME=opengrc
DB_PASSWORD=your_secure_password

# Cache & Session
CACHE_DRIVER=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis

# Redis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

# Muraji API (for fetching frameworks)
MURAJI_API_URL=https://muraji-api.wathbahs.com/api/libraries?format=opengrc&output=full
```

**Generate application key and run setup:**

```bash
# Generate app key
php artisan key:generate

# Run migrations
php artisan migrate --force

# Seed database (optional)
php artisan db:seed --force

# Create storage link
php artisan storage:link

# Cache configuration
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Clear any old caches
php artisan cache:clear
```

---

## Step 5: Set Permissions

```bash
# Set ownership
sudo chown -R www-data:www-data /var/www/opengrc

# Set directory permissions
sudo find /var/www/opengrc -type d -exec chmod 755 {} \;
sudo find /var/www/opengrc -type f -exec chmod 644 {} \;

# Set writable permissions for storage and cache
sudo chmod -R 775 /var/www/opengrc/storage
sudo chmod -R 775 /var/www/opengrc/bootstrap/cache
sudo chmod -R 775 /var/www/opengrc/database

# Ensure log file exists and is writable
sudo touch /var/www/opengrc/storage/logs/laravel.log
sudo chmod 664 /var/www/opengrc/storage/logs/laravel.log
sudo chown www-data:www-data /var/www/opengrc/storage/logs/laravel.log
```

---

## Step 6: Configure PHP-FPM

```bash
# Edit PHP-FPM pool configuration
sudo nano /etc/php/8.2/fpm/pool.d/www.conf
```

**Recommended settings:**

```ini
; Process manager settings
pm = dynamic
pm.max_children = 50
pm.start_servers = 5
pm.min_spare_servers = 5
pm.max_spare_servers = 35
pm.max_requests = 500

; User/Group
user = www-data
group = www-data
listen.owner = www-data
listen.group = www-data
```

**Edit PHP settings:**

```bash
sudo nano /etc/php/8.2/fpm/php.ini
```

```ini
upload_max_filesize = 100M
post_max_size = 100M
memory_limit = 512M
max_execution_time = 300
max_input_time = 300
```

**Restart PHP-FPM:**

```bash
sudo systemctl restart php8.2-fpm
```

---

## Step 7: Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/opengrc
```

**Paste this configuration:**

```nginx
# /etc/nginx/sites-available/opengrc

server {
    listen 80;
    listen [::]:80;
    server_name opengrc.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name opengrc.yourdomain.com;

    # Document root
    root /var/www/opengrc/public;
    index index.php index.html;

    # SSL Configuration (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/opengrc.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/opengrc.yourdomain.com/privkey.pem;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Logging
    access_log /var/log/nginx/opengrc.access.log;
    error_log /var/log/nginx/opengrc.error.log;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;

    # Client body size (for file uploads)
    client_max_body_size 100M;

    # Charset
    charset utf-8;

    # Main location block
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # PHP-FPM Configuration
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        
        # Timeouts
        fastcgi_connect_timeout 60s;
        fastcgi_send_timeout 300s;
        fastcgi_read_timeout 300s;
        
        # Buffer settings
        fastcgi_buffer_size 128k;
        fastcgi_buffers 4 256k;
        fastcgi_busy_buffers_size 256k;
    }

    # Deny access to hidden files
    location ~ /\.(?!well-known).* {
        deny all;
    }

    # Deny access to sensitive files
    location ~ /\.env {
        deny all;
    }

    # Static file caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|pdf|woff|woff2|ttf|svg|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Livewire specific
    location /livewire {
        try_files $uri $uri/ /index.php?$query_string;
    }
}
```

**Enable the site:**

```bash
# Create symbolic link
sudo ln -sf /etc/nginx/sites-available/opengrc /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## Step 8: Install SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d opengrc.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

---

## Step 9: Configure Queue Worker (Supervisor)

```bash
# Install Supervisor
sudo apt install supervisor -y

# Create worker configuration
sudo nano /etc/supervisor/conf.d/opengrc-worker.conf
```

**Paste:**

```ini
[program:opengrc-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/opengrc/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/opengrc/storage/logs/worker.log
stopwaitsecs=3600
```

**Start workers:**

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start opengrc-worker:*
```

---

## Step 10: Configure Scheduler (Cron)

```bash
# Edit crontab
sudo crontab -e
```

**Add this line:**

```cron
* * * * * cd /var/www/opengrc && php artisan schedule:run >> /dev/null 2>&1
```

---

## Step 11: Firewall Configuration

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Maintenance Commands

### Update Application

```bash
cd /var/www/opengrc

# Pull latest code
git pull origin main

# Install dependencies
composer install --optimize-autoloader --no-dev

# Build assets (if needed)
npm ci && npm run build && rm -rf node_modules

# Run migrations
php artisan migrate --force

# Clear and rebuild caches
php artisan cache:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Restart queue workers
sudo supervisorctl restart opengrc-worker:*
```

### View Logs

```bash
# Laravel logs
tail -f /var/www/opengrc/storage/logs/laravel.log

# Nginx access logs
tail -f /var/log/nginx/opengrc.access.log

# Nginx error logs
tail -f /var/log/nginx/opengrc.error.log

# Queue worker logs
tail -f /var/www/opengrc/storage/logs/worker.log
```

### Restart Services

```bash
# Restart PHP-FPM
sudo systemctl restart php8.2-fpm

# Restart Nginx
sudo systemctl restart nginx

# Restart Redis
sudo systemctl restart redis

# Restart queue workers
sudo supervisorctl restart opengrc-worker:*
```

---

## Troubleshooting

### Permission Issues

```bash
sudo chown -R www-data:www-data /var/www/opengrc
sudo chmod -R 775 /var/www/opengrc/storage
sudo chmod -R 775 /var/www/opengrc/bootstrap/cache
```

### 502 Bad Gateway

```bash
# Check PHP-FPM is running
sudo systemctl status php8.2-fpm

# Check socket exists
ls -la /var/run/php/php8.2-fpm.sock

# Check Nginx error log
sudo tail -f /var/log/nginx/opengrc.error.log
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
psql -h 127.0.0.1 -U opengrc -d opengrc_db

# Check Laravel can connect
cd /var/www/opengrc
php artisan tinker
>>> DB::connection()->getPdo();
```

### Clear All Caches

```bash
cd /var/www/opengrc
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear
composer dump-autoload
```

---

## Security Checklist

- [ ] `APP_DEBUG=false` in production
- [ ] Strong database password
- [ ] SSL certificate installed
- [ ] Firewall enabled (UFW)
- [ ] File permissions set correctly
- [ ] `.env` file not accessible via web
- [ ] Regular backups configured
- [ ] Log rotation configured
- [ ] Fail2ban installed (optional)
