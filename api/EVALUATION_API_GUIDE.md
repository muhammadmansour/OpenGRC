# Gemini AI Evaluation API Guide

## Overview

This API provides AI-powered evaluation of audit items using Google's Gemini AI. It analyzes audit evidence, provides compliance assessments, and generates actionable recommendations.

## Setup

### 1. Install Dependencies

```bash
cd api
npm install
```

This will install:
- `@google/generative-ai` - Google Gemini AI SDK
- `multer` - File upload handling

### 2. Configure Environment Variables

Add the following to your `.env` file:

```env
# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here
```

**To get a Gemini API key:**
1. Visit https://makersuite.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key and add it to your `.env` file

### 3. Start the Server

```bash
npm run dev
```

The API will be available at:
- **Production**: `https://muraji-api.wathbahs.com/`
- **Development**: `http://localhost:2020`

## API Endpoints

### 1. Check Evaluation Service Status

```http
GET /api/evaluations/status
```

**Response:**
```json
{
  "available": true,
  "service": "Gemini AI Evaluation",
  "model": "gemini-1.5-flash",
  "status": "ready",
  "message": "AI evaluation service is ready"
}
```

---

### 2. Evaluate Single Audit Item

```http
POST /api/evaluations/audit-item
```

**Request Body:**
```json
{
  "title": "Employ FIPS-validated cryptography",
  "code": "3.13.11",
  "description": "Cryptography can be employed to support many security solutions including...",
  "discussion": "Cryptographic standards include FIPS-validated cryptography...",
  "applicability": "Applicable",
  "fileNames": ["policy.pdf", "implementation.docx"],
  "fileContents": ["File content as text...", "Another file content..."]
}
```

**Response:**
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
    "summary": "Strong compliance demonstrated with comprehensive documentation...",
    "detailedAnalysis": "The submitted evidence demonstrates...",
    "riskAssessment": "low",
    "nextSteps": [
      "Schedule next review in 3 months",
      "Update documentation with review dates"
    ],
    "evaluatedAt": "2026-01-14T15:30:00.000Z",
    "aiModel": "gemini-1.5-flash",
    "itemCode": "3.13.11",
    "itemTitle": "Employ FIPS-validated cryptography"
  },
  "metadata": {
    "itemCode": "3.13.11",
    "itemTitle": "Employ FIPS-validated cryptography",
    "evaluatedAt": "2026-01-14T15:30:00.000Z",
    "filesAnalyzed": 2
  }
}
```

---

### 3. Batch Evaluate Multiple Items

```http
POST /api/evaluations/batch
```

**Request Body:**
```json
{
  "items": [
    {
      "id": "item-1",
      "title": "Item 1",
      "code": "3.13.11",
      "description": "Description...",
      "fileContents": ["content..."]
    },
    {
      "id": "item-2",
      "title": "Item 2",
      "code": "3.13.12",
      "description": "Description...",
      "fileContents": ["content..."]
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0
  },
  "results": [
    {
      "itemId": "item-1",
      "success": true,
      "evaluation": { /* ... */ }
    },
    {
      "itemId": "item-2",
      "success": true,
      "evaluation": { /* ... */ }
    }
  ]
}
```

---

### 4. Generate Strategic Recommendations

```http
POST /api/evaluations/recommendations
```

**Request Body:**
```json
{
  "evaluationHistory": [
    {
      "itemCode": "3.13.11",
      "score": 85,
      "complianceLevel": "high",
      "weaknesses": ["Missing review process"]
    },
    {
      "itemCode": "3.13.12",
      "score": 70,
      "complianceLevel": "medium",
      "weaknesses": ["Incomplete documentation"]
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "recommendations": "Based on the evaluation history, here are strategic recommendations...",
  "generatedAt": "2026-01-14T15:30:00.000Z"
}
```

---

### 5. Quick Analysis (Preview)

```http
POST /api/evaluations/quick-analysis
```

**Request Body:**
```json
{
  "title": "Audit Item Title",
  "description": "Detailed description of the audit item...",
  "fileCount": 3
}
```

**Response:**
```json
{
  "success": true,
  "quickAnalysis": {
    "readinessScore": 90,
    "readinessLevel": "Ready",
    "issues": [],
    "suggestions": [
      "Good: Detailed description provided",
      "Good: 3 evidence file(s) submitted"
    ],
    "canProceedWithFullEvaluation": true
  }
}
```

## Evaluation Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Compliance status: "Fully Compliant", "Partially Compliant", "Non-Compliant", "Not Applicable" |
| `effectiveness` | string | Implementation effectiveness: "Highly Effective", "Effective", "Partially Effective", "Ineffective" |
| `score` | number | Numerical score (0-100) |
| `complianceLevel` | string | Overall compliance: "high", "medium", "low" |
| `strengths` | array | List of identified strengths |
| `weaknesses` | array | List of gaps or issues |
| `recommendations` | array | Actionable improvement suggestions |
| `evidenceQuality` | string | Quality of submitted evidence |
| `summary` | string | Brief overall assessment |
| `detailedAnalysis` | string | Comprehensive analysis |
| `riskAssessment` | string | Risk level: "low", "medium", "high" |
| `nextSteps` | array | Suggested next actions |

## Integration Example

### Frontend Integration (React/Vue)

```javascript
async function evaluateAuditItem(itemData, files) {
  const response = await fetch('https://muraji-api.wathbahs.com/api/evaluations/audit-item', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'userid': userId
    },
    body: JSON.stringify({
      title: itemData.title,
      code: itemData.code,
      description: itemData.description,
      discussion: itemData.discussion,
      applicability: itemData.applicability,
      fileNames: files.map(f => f.name),
      fileContents: await Promise.all(files.map(f => readFileAsText(f)))
    })
  });

  const result = await response.json();
  
  if (result.success) {
    return result.evaluation;
  } else {
    throw new Error(result.message);
  }
}
```

### Laravel Backend Integration

```php
use Illuminate\Support\Facades\Http;

public function evaluateAuditItem($auditItem, $files)
{
    $response = Http::withHeaders([
        'Authorization' => 'Bearer ' . auth()->token(),
        'userid' => auth()->id()
    ])->post('https://muraji-api.wathbahs.com/api/evaluations/audit-item', [
        'title' => $auditItem->title,
        'code' => $auditItem->code,
        'description' => $auditItem->description,
        'discussion' => $auditItem->discussion,
        'applicability' => $auditItem->applicability,
        'fileNames' => $files->pluck('name'),
        'fileContents' => $files->map(fn($f) => file_get_contents($f->path()))
    ]);

    return $response->json();
}
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error Type",
  "message": "Detailed error message",
  "details": "Additional information (optional)"
}
```

Common error codes:
- `400` - Validation Error (missing/invalid parameters)
- `401` - Unauthorized (missing/invalid auth token)
- `503` - Service Unavailable (Gemini API not configured)
- `500` - Internal Server Error

## Best Practices

1. **File Contents**: Keep file contents under 10,000 characters per file for optimal performance
2. **Batch Size**: Limit batch evaluations to 10 items at a time
3. **Rate Limiting**: Implement client-side rate limiting (max 1 request/second)
4. **Error Handling**: Always check the `success` field before accessing evaluation data
5. **Caching**: Cache evaluation results to reduce API calls

## Testing

### Using cURL

```bash
# Check status
curl https://muraji-api.wathbahs.com/api/evaluations/status

# Evaluate audit item
curl -X POST https://muraji-api.wathbahs.com/api/evaluations/audit-item \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Test Item",
    "code": "TEST-001",
    "description": "Test description",
    "fileNames": ["test.pdf"],
    "fileContents": ["Test file content"]
  }'
```

## Troubleshooting

### "Service Unavailable" Error

**Cause**: GEMINI_API_KEY not set in environment variables

**Solution**: 
1. Get API key from https://makersuite.google.com/app/apikey
2. Add to `.env` file: `GEMINI_API_KEY=your_key_here`
3. Restart the server

### Slow Response Times

**Cause**: Large file contents or complex evaluations

**Solutions**:
- Truncate file contents to essential parts only
- Use quick-analysis endpoint for preview
- Implement client-side loading indicators

### Parse Errors

**Cause**: Gemini returns non-JSON response

**Fallback**: The service automatically returns a safe fallback evaluation with `parseError: true` flag

## Support

For issues or questions:
- Check API documentation: http://localhost:2020/docs
- Review logs in the terminal
- Contact development team

## License

Part of the OpenGRC project
