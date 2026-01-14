# Quick Reference - Gemini Evaluation API

## 🌐 Production URL
```
https://muraji-api.wathbahs.com
```

## 🔑 Getting Started

1. **Get Gemini API Key**: https://makersuite.google.com/app/apikey
2. **Add to `.env`**: `GEMINI_API_KEY=your_key_here`
3. **Test**: `curl https://muraji-api.wathbahs.com/api/evaluations/status`

## 📍 Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check |
| GET | `/api/health` | API health check |
| GET | `/docs` | Swagger documentation |
| GET | `/api/evaluations/status` | Check if Gemini is configured |
| POST | `/api/evaluations/audit-item` | Evaluate single audit item |
| POST | `/api/evaluations/batch` | Evaluate multiple items |
| POST | `/api/evaluations/quick-analysis` | Quick readiness check |
| POST | `/api/evaluations/recommendations` | Get strategic recommendations |

## 🚀 Quick Test

### Check Status
```bash
curl https://muraji-api.wathbahs.com/api/evaluations/status
```

### Evaluate Audit Item
```bash
curl -X POST https://muraji-api.wathbahs.com/api/evaluations/audit-item \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "userid: YOUR_USER_ID" \
  -d '{
    "title": "Employ FIPS-validated cryptography",
    "code": "3.13.11",
    "description": "Use FIPS-validated cryptography for data protection",
    "discussion": "Implementation requires FIPS 140-2 validated modules",
    "applicability": "Applicable",
    "fileNames": ["policy.pdf"],
    "fileContents": ["Policy content here..."]
  }'
```

## 💻 Frontend Integration (Laravel)

```php
// config/services.php
'evaluation_api' => [
    'url' => env('EVALUATION_API_URL', 'https://muraji-api.wathbahs.com'),
],

// .env
EVALUATION_API_URL=https://muraji-api.wathbahs.com

// Usage
$response = Http::withHeaders([
    'Authorization' => 'Bearer ' . auth()->token(),
    'userid' => auth()->id()
])->post(config('services.evaluation_api.url') . '/api/evaluations/audit-item', [
    'title' => $auditItem->title,
    'code' => $auditItem->code,
    'description' => $auditItem->description,
    // ...
]);

$evaluation = $response->json()['evaluation'];
```

## 📊 Response Structure

```json
{
  "success": true,
  "evaluation": {
    "status": "Fully Compliant | Partially Compliant | Non-Compliant",
    "score": 92,
    "complianceLevel": "high | medium | low",
    "effectiveness": "Highly Effective | Effective | Partially Effective | Ineffective",
    "strengths": ["..."],
    "weaknesses": ["..."],
    "recommendations": ["..."],
    "evidenceQuality": "Excellent | Good | Adequate | Poor",
    "summary": "Brief assessment...",
    "detailedAnalysis": "Comprehensive analysis...",
    "riskAssessment": "low | medium | high",
    "nextSteps": ["..."],
    "evaluatedAt": "2026-01-14T15:30:00.000Z",
    "aiModel": "gemini-1.5-flash",
    "itemCode": "3.13.11",
    "itemTitle": "..."
  }
}
```

## ⚙️ Configuration

### Required Environment Variables
```env
# Gemini AI (Required for evaluation)
GEMINI_API_KEY=your_gemini_api_key

# Database (Required)
DB_HOST=34.1.36.28
DB_PORT=5432
DB_NAME=opengrc_db
DB_USER=opengrc
DB_PASSWORD=password123

# CORS (Required for frontend access)
CORS_ORIGINS=https://opengrc.wathbahs.com,https://muraji.wathbahs.com
```

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| 503 Service Unavailable | Set `GEMINI_API_KEY` in `.env` |
| 502 Bad Gateway | Check if Node.js app is running (`pm2 status`) |
| CORS Error | Add frontend domain to `CORS_ORIGINS` |
| Database Error | Verify `DB_*` credentials and PostgreSQL is accessible |
| Slow Response | Normal for AI processing (10-30 seconds) |

## 📚 Documentation

- **Full API Guide**: [EVALUATION_API_GUIDE.md](./EVALUATION_API_GUIDE.md)
- **Frontend Integration**: [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md)
- **Deployment Guide**: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- **Main README**: [README_GEMINI_EVALUATION.md](./README_GEMINI_EVALUATION.md)
- **Swagger Docs**: https://muraji-api.wathbahs.com/docs

## 🎯 Common Use Cases

### 1. Evaluate Single Audit Item
```javascript
const evaluation = await fetch('https://muraji-api.wathbahs.com/api/evaluations/audit-item', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'userid': userId
  },
  body: JSON.stringify({ title, code, description, fileContents })
});
```

### 2. Quick Readiness Check
```javascript
const quickCheck = await fetch('https://muraji-api.wathbahs.com/api/evaluations/quick-analysis', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title, description, fileCount })
});
```

### 3. Batch Evaluation
```javascript
const batch = await fetch('https://muraji-api.wathbahs.com/api/evaluations/batch', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ items: [...] })
});
```

## 💡 Tips

- **Rate Limiting**: Max 60 requests/minute
- **File Size**: Keep file contents under 10,000 chars per file
- **Timeout**: Allow 60 seconds for evaluation
- **Caching**: Cache results to reduce API calls
- **Error Handling**: Always check `success` field before using data

## 🔐 Security Headers Required

```javascript
headers: {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer YOUR_TOKEN',  // Required
  'userid': 'USER_ID'                     // Required
}
```

## 📞 Support

- **Health Check**: https://muraji-api.wathbahs.com/health
- **API Docs**: https://muraji-api.wathbahs.com/docs
- **Status Check**: `curl https://muraji-api.wathbahs.com/api/evaluations/status`

---

**Last Updated**: 2026-01-14  
**API Version**: 1.0.0  
**Powered by**: Google Gemini 1.5 Flash
