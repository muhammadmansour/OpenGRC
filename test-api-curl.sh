#!/bin/bash

echo "=================================================="
echo "🔍 API DIAGNOSTIC TEST"
echo "=================================================="
echo ""

echo "1️⃣ Testing if API is running locally on port 2020..."
echo "---"
curl -s http://localhost:2020/health || echo "❌ FAILED: API not responding on localhost:2020"
echo ""
echo ""

echo "2️⃣ Testing /api/evaluations/status locally..."
echo "---"
curl -s http://localhost:2020/api/evaluations/status || echo "❌ FAILED"
echo ""
echo ""

echo "3️⃣ Testing if port 2020 is listening..."
echo "---"
netstat -tuln | grep 2020 || echo "❌ Port 2020 not listening"
echo ""
echo ""

echo "4️⃣ Testing Nginx proxy to /health (external URL)..."
echo "---"
curl -s https://muraji-api.wathbahs.com/health || echo "❌ FAILED: Cannot reach via Nginx"
echo ""
echo ""

echo "5️⃣ Testing Nginx proxy to /api/evaluations/status..."
echo "---"
curl -s https://muraji-api.wathbahs.com/api/evaluations/status || echo "❌ FAILED"
echo ""
echo ""

echo "6️⃣ Testing POST to /api/evaluations/audit-item..."
echo "---"
curl -X POST https://muraji-api.wathbahs.com/api/evaluations/audit-item \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "title": "Test Control",
    "code": "TEST-001",
    "description": "Test description",
    "discussion": "Test discussion",
    "applicability": "applicable",
    "fileNames": ["test.pdf"],
    "fileContents": ["Test content"]
  }' \
  -w "\n\nHTTP Status: %{http_code}\n" || echo "❌ FAILED"
echo ""
echo ""

echo "7️⃣ Checking PM2 status..."
echo "---"
pm2 list
echo ""
echo ""

echo "8️⃣ Checking PM2 logs (last 20 lines)..."
echo "---"
pm2 logs muraji-api --lines 20 --nostream
echo ""
echo ""

echo "9️⃣ Testing with verbose curl (shows headers)..."
echo "---"
curl -v https://muraji-api.wathbahs.com/api/evaluations/status 2>&1 | head -30
echo ""
echo ""

echo "🔟 Checking Nginx configuration..."
echo "---"
sudo nginx -t
echo ""

echo "=================================================="
echo "✅ DIAGNOSTIC COMPLETE"
echo "=================================================="
