# Chat API Guide

## Overview

The Chat API is a general-purpose AI service that can analyze any context with optional file attachments and return structured evaluations. It's flexible and can be used for audit evaluations, compliance checks, code reviews, risk assessments, and more.

## Base URL

```
https://muraji-api.wathbahs.com/api/chat
```

## Authentication

Currently, the chat endpoints are **public** (no authentication required). For production, implement token-based authentication.

---

## Endpoints

### 1. POST `/api/chat`

**General AI chat and analysis endpoint**

#### Request Body

```json
{
  "context": "Your text context here...",
  "files": [
    {
      "name": "document.pdf",
      "mimeType": "application/pdf",
      "description": "Optional description",
      "data": "base64_encoded_data...",
      "size": 123456,
      "encoding": "base64"
    }
  ]
}
```

#### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `context` | string | Yes | The main text context to analyze |
| `files` | array | No | Array of file objects (default: `[]`) |
| `files[].name` | string | Yes* | File name |
| `files[].mimeType` | string | Yes* | MIME type (e.g., `application/pdf`) |
| `files[].data` | string | Yes* | File content (base64 or plain text) |
| `files[].encoding` | string | Yes* | Either `"base64"` or `"text"` |
| `files[].description` | string | No | Optional file description |
| `files[].size` | number | No | File size in bytes |

*Required if `files` array is not empty

#### Response (200 OK)

```json
{
  "success": true,
  "response": {
    "status": "Partially Compliant",
    "compliance_status": "Partially Compliant",
    "effectiveness": "Effective",
    "score": 75,
    "complianceLevel": "medium",
    "strengths": [
      "Clear documentation provided",
      "Evidence files submitted"
    ],
    "weaknesses": [
      "Some technical details missing"
    ],
    "recommendations": [
      "Include more detailed specifications"
    ],
    "evidenceQuality": "Good",
    "summary": "Brief overall assessment...",
    "detailedAnalysis": "Comprehensive analysis...",
    "riskAssessment": "medium",
    "nextSteps": [
      "Review technical specifications"
    ],
    "note": "Additional notes...",
    "timestamp": "2026-01-14T12:00:00.000Z",
    "aiModel": "gemini-2.0-flash-exp"
  },
  "metadata": {
    "timestamp": "2026-01-14T12:00:00.000Z",
    "contextLength": 1234,
    "filesAnalyzed": 2
  }
}
```

#### Error Responses

**400 Bad Request**
```json
{
  "error": "Validation Error",
  "message": "context is required"
}
```

**503 Service Unavailable**
```json
{
  "error": "Service Unavailable",
  "message": "AI chat service is not configured. Please set GEMINI_API_KEY in environment variables"
}
```

**500 Internal Server Error**
```json
{
  "error": "Chat Failed",
  "message": "AI Chat failed: [error details]",
  "details": "The AI chat service encountered an error..."
}
```

---

### 2. POST `/api/chat/batch`

**Batch process multiple contexts**

#### Request Body

```json
{
  "items": [
    {
      "id": "item-1",
      "context": "First context...",
      "files": []
    },
    {
      "id": "item-2",
      "context": "Second context...",
      "files": []
    }
  ]
}
```

#### Response (200 OK)

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
      "response": { /* full response object */ }
    },
    {
      "itemId": "item-2",
      "success": true,
      "response": { /* full response object */ }
    }
  ]
}
```

---

### 3. GET `/api/chat/status`

**Check if chat service is available**

#### Response (200 OK)

```json
{
  "available": true,
  "service": "Gemini AI Chat",
  "model": "gemini-2.0-flash-exp",
  "status": "ready",
  "message": "AI chat service is ready"
}
```

When service is not configured:

```json
{
  "available": false,
  "service": "Gemini AI Chat",
  "model": null,
  "status": "not configured",
  "message": "GEMINI_API_KEY environment variable not set"
}
```

---

## Examples

### cURL Examples

#### Basic Chat Request

```bash
curl -X POST https://muraji-api.wathbahs.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "context": "Review this security policy implementation...",
    "files": []
  }'
```

#### With Files

```bash
curl -X POST https://muraji-api.wathbahs.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "context": "Evaluate compliance with NIST standards",
    "files": [
      {
        "name": "policy.txt",
        "mimeType": "text/plain",
        "data": "Security policy content...",
        "encoding": "text"
      }
    ]
  }'
```

#### Batch Request

```bash
curl -X POST https://muraji-api.wathbahs.com/api/chat/batch \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "id": "1",
        "context": "First audit item...",
        "files": []
      },
      {
        "id": "2",
        "context": "Second audit item...",
        "files": []
      }
    ]
  }'
```

#### Status Check

```bash
curl https://muraji-api.wathbahs.com/api/chat/status
```

---

### JavaScript/Fetch Example

```javascript
async function chatWithAI(context, files = []) {
  const response = await fetch('https://muraji-api.wathbahs.com/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ context, files })
  });

  if (!response.ok) {
    throw new Error(`Chat failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.response;
}

// Usage
const context = `
**AUDIT ITEM:**
Code: 3.13.11
Title: Employ FIPS-validated cryptography
Description: Use FIPS 140-2 validated cryptography...
`;

const files = [
  {
    name: "evidence.pdf",
    mimeType: "application/pdf",
    data: "JVBERi0xLjQK...", // base64
    encoding: "base64",
    size: 234567
  }
];

const result = await chatWithAI(context, files);
console.log(result);
```

---

### TypeScript Example

```typescript
interface ChatRequest {
  context: string;
  files?: FileData[];
}

interface FileData {
  name: string;
  mimeType: string;
  data: string;
  encoding: 'text' | 'base64';
  description?: string;
  size?: number;
}

interface ChatResponse {
  success: boolean;
  response: {
    status: string;
    score: number;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    summary: string;
    detailedAnalysis: string;
    // ... other fields
  };
  metadata: {
    timestamp: string;
    contextLength: number;
    filesAnalyzed: number;
  };
}

async function chat(request: ChatRequest): Promise<ChatResponse> {
  const response = await fetch('https://muraji-api.wathbahs.com/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Chat failed: ${response.statusText}`);
  }

  return response.json();
}
```

---

## File Handling

### Text Files
Send content directly:
```json
{
  "name": "notes.txt",
  "mimeType": "text/plain",
  "data": "Plain text content here",
  "encoding": "text"
}
```

### Binary Files (PDFs, Images, etc.)
Send as base64:
```json
{
  "name": "document.pdf",
  "mimeType": "application/pdf",
  "data": "JVBERi0xLjQKJeLjz9MK...",
  "encoding": "base64",
  "size": 234567
}
```

### Supported MIME Types

**Text (encoding: "text")**
- `text/plain`
- `text/markdown`
- `application/json`
- `text/xml`
- `text/csv`

**Binary (encoding: "base64")**
- `application/pdf`
- `application/msword`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `image/jpeg`, `image/png`, `image/gif`, `image/webp`

---

## Rate Limits

- No rate limiting currently implemented
- Recommended: 10 requests/minute per client
- Gemini API has its own quotas (check Google's documentation)

---

## Best Practices

1. **Context:**
   - Be specific and clear
   - Keep under 20,000 characters for optimal performance
   - Structure your context for readability

2. **Files:**
   - Limit file sizes (< 5MB recommended)
   - Maximum 5 files per request
   - Use descriptive file names
   - Always provide file descriptions

3. **Performance:**
   - Expect 5-30 seconds response time
   - Text files process faster than PDFs
   - Larger contexts take longer

4. **Error Handling:**
   - Always check response status
   - Implement retry logic for 5xx errors
   - Log errors for debugging

---

## Environment Variables

### Server-side (.env)

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

### Client-side

Laravel `config/services.php`:
```php
'chat_api' => [
    'url' => env('CHAT_API_URL', 'https://muraji-api.wathbahs.com'),
    'timeout' => env('CHAT_API_TIMEOUT', 60),
],
```

---

## Troubleshooting

### 503 Service Unavailable
- Check if `GEMINI_API_KEY` is set in `.env`
- Restart the API server: `pm2 restart muraji-api`

### 400 Bad Request
- Ensure `context` field is provided
- Check JSON format is valid
- Verify file objects have all required fields

### Slow Response
- Reduce context length
- Reduce number of files
- Use smaller files

### CORS Errors (from browser)
- Ensure your domain is in `CORS_ORIGINS`
- Check CSP headers allow the API domain

---

## Version History

- **v2.0** (2026-01-14): Renamed from "Evaluation API" to "Chat API", simplified to use `context` and `files`
- **v1.0** (2026-01-13): Initial release with audit-specific fields
