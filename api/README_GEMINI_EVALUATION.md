# 🤖 Gemini AI Audit Evaluation System

## Quick Start

### 1. Get Your Gemini API Key

1. Visit https://makersuite.google.com/app/apikey
2. Click "Create API Key" 
3. Copy your API key

### 2. Configure Environment

Add to your `.env` file:

```env
GEMINI_API_KEY=your_api_key_here
```

### 3. Install and Run

```bash
cd api
npm install
npm run dev
```

Production API: `https://muraji-api.wathbahs.com/`  
Development: `http://localhost:2020`

### 4. Test the API

**Production:**
```bash
curl https://muraji-api.wathbahs.com/api/evaluations/status
```

**Local Development:**
```bash
node test-evaluation.js
```

## Features

✅ **AI-Powered Evaluation** - Uses Google Gemini 1.5 Flash for intelligent audit analysis  
✅ **Comprehensive Scoring** - Provides 0-100 scores with detailed breakdowns  
✅ **Evidence Analysis** - Analyzes submitted files and documents  
✅ **Actionable Recommendations** - Generates specific improvement suggestions  
✅ **Risk Assessment** - Identifies compliance risks (low/medium/high)  
✅ **Batch Processing** - Evaluate multiple items simultaneously  
✅ **RESTful API** - Easy integration with any frontend  

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/evaluations/status` | GET | Check if Gemini is configured |
| `/api/evaluations/audit-item` | POST | Evaluate single audit item |
| `/api/evaluations/batch` | POST | Evaluate multiple items |
| `/api/evaluations/recommendations` | POST | Generate strategic recommendations |
| `/api/evaluations/quick-analysis` | POST | Quick readiness check |

## Example Usage

### JavaScript/Fetch

```javascript
const response = await fetch('https://muraji-api.wathbahs.com/api/evaluations/audit-item', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    title: 'Employ FIPS-validated cryptography',
    code: '3.13.11',
    description: 'Use FIPS-validated cryptography...',
    fileNames: ['policy.pdf'],
    fileContents: ['File content...']
  })
});

const result = await response.json();
console.log('Score:', result.evaluation.score);
console.log('Status:', result.evaluation.status);
```

### PHP/Laravel

```php
$response = Http::post('https://muraji-api.wathbahs.com/api/evaluations/audit-item', [
    'title' => 'Employ FIPS-validated cryptography',
    'code' => '3.13.11',
    'description' => 'Use FIPS-validated cryptography...',
    'fileNames' => ['policy.pdf'],
    'fileContents' => ['File content...']
]);

$evaluation = $response->json()['evaluation'];
echo "Score: " . $evaluation['score'];
```

### cURL

```bash
curl -X POST https://muraji-api.wathbahs.com/api/evaluations/audit-item \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Employ FIPS-validated cryptography",
    "code": "3.13.11",
    "description": "Use FIPS-validated cryptography...",
    "fileNames": ["policy.pdf"],
    "fileContents": ["File content..."]
  }'
```

## Evaluation Response

```json
{
  "success": true,
  "evaluation": {
    "status": "Fully Compliant",
    "effectiveness": "Highly Effective",
    "score": 92,
    "complianceLevel": "high",
    "strengths": [
      "FIPS-validated cryptography properly documented",
      "Clear implementation procedures provided"
    ],
    "weaknesses": [
      "Missing evidence of periodic review"
    ],
    "recommendations": [
      "Implement quarterly cryptography review process",
      "Add version control for cryptographic policies"
    ],
    "evidenceQuality": "Excellent",
    "summary": "Strong compliance demonstrated...",
    "detailedAnalysis": "The submitted evidence...",
    "riskAssessment": "low",
    "nextSteps": [
      "Schedule next review in 3 months"
    ],
    "evaluatedAt": "2026-01-14T15:30:00.000Z",
    "aiModel": "gemini-1.5-flash",
    "itemCode": "3.13.11",
    "itemTitle": "Employ FIPS-validated cryptography"
  }
}
```

## Documentation

📖 **[EVALUATION_API_GUIDE.md](./EVALUATION_API_GUIDE.md)** - Complete API documentation  
📖 **[FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md)** - Laravel/Filament integration guide  
🧪 **[test-evaluation.js](./test-evaluation.js)** - Test script  

## Architecture

```
┌─────────────────┐
│  Laravel/PHP    │
│  (Filament UI)  │
└────────┬────────┘
         │ HTTP POST
         │ /api/evaluations/audit-item
         ▼
┌─────────────────┐
│  Node.js/       │
│  Express API    │
│  (Port 2020)    │
└────────┬────────┘
         │
         │ Uses
         ▼
┌─────────────────┐      ┌──────────────┐
│  Gemini Service │◄────►│ PostgreSQL   │
│  (AI Analysis)  │      │  Database    │
└─────────────────┘      └──────────────┘
         │
         │ Calls
         ▼
┌─────────────────┐
│  Google Gemini  │
│  AI API         │
└─────────────────┘
```

## Files Created

```
api/
├── package.json                          # Updated with dependencies
├── index.js                              # Updated with evaluation routes
├── services/
│   └── gemini-evaluation.service.js      # ✨ NEW: Gemini AI service
├── routes/
│   └── evaluation.routes.js              # ✨ NEW: Evaluation endpoints
├── EVALUATION_API_GUIDE.md               # ✨ NEW: API documentation
├── FRONTEND_INTEGRATION.md               # ✨ NEW: Frontend integration guide
├── README_GEMINI_EVALUATION.md           # ✨ NEW: This file
└── test-evaluation.js                    # ✨ NEW: Test script
```

## Troubleshooting

### "Service Unavailable" Error

**Problem**: API returns 503 error  
**Cause**: GEMINI_API_KEY not set  
**Solution**: Add `GEMINI_API_KEY=your_key` to `.env` and restart server

### Slow Responses

**Problem**: Evaluations take too long  
**Cause**: Large file contents or complex analysis  
**Solution**: 
- Truncate file contents to essential parts
- Use quick-analysis endpoint first
- Implement loading indicators

### Connection Refused

**Problem**: Cannot connect to API  
**Cause**: Server not running  
**Solution**: Run `npm run dev` in api directory

## Cost Considerations

Gemini 1.5 Flash pricing (as of Jan 2026):
- **Input**: $0.075 per 1M tokens
- **Output**: $0.30 per 1M tokens

Typical evaluation costs:
- Simple evaluation: ~$0.001
- Complex with files: ~$0.005
- Batch of 10 items: ~$0.03

💡 **Tip**: Use quick-analysis endpoint for previews to save costs

## Security Best Practices

1. ✅ Always validate auth tokens
2. ✅ Implement rate limiting (max 60 requests/minute)
3. ✅ Sanitize file inputs
4. ✅ Use HTTPS in production
5. ✅ Never expose Gemini API key to frontend
6. ✅ Log all evaluations for audit trail

## Next Steps

1. **Test the API**: Run `node test-evaluation.js`
2. **Read the docs**: See `EVALUATION_API_GUIDE.md`
3. **Integrate frontend**: Follow `FRONTEND_INTEGRATION.md`
4. **Configure database**: Store evaluation results
5. **Deploy**: Set up production environment

## Support

- 📚 Full API docs: https://muraji-api.wathbahs.com/docs
- 🐛 Check logs in terminal for errors
- 💬 Review code comments for details

## License

Part of the OpenGRC project

---

**Ready to start?** Run `node test-evaluation.js` to test your setup! 🚀
