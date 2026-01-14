# General Chat API Usage

The Chat API is designed to be **flexible and general-purpose**. It can work with any type of content and provide AI-powered analysis and evaluation.

## API Endpoint

```
POST /api/chat
```

## Request Format

```json
{
  "context": "Any text context you want to evaluate",
  "files": [
    {
      "name": "document.pdf",
      "mimeType": "application/pdf",
      "description": "Optional description of the file",
      "data": "base64EncodedData...",
      "size": 123456,
      "encoding": "base64"
    },
    {
      "name": "notes.txt",
      "mimeType": "text/plain",
      "description": "Additional notes",
      "data": "Plain text content...",
      "encoding": "text"
    }
  ]
}
```

## Response Format

```json
{
  "success": true,
  "evaluation": {
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
      "Some technical details missing",
      "Additional testing recommended"
    ],
    "recommendations": [
      "Include more detailed technical specifications",
      "Conduct comprehensive testing",
      "Document edge cases"
    ],
    "evidenceQuality": "Good",
    "summary": "The submission demonstrates good compliance with most requirements...",
    "detailedAnalysis": "Full analysis text...",
    "riskAssessment": "medium",
    "nextSteps": [
      "Review technical specifications",
      "Schedule testing phase"
    ],
    "note": "Manual review of PDF documents recommended"
  },
  "metadata": {
    "evaluatedAt": "2026-01-14T...",
    "contextLength": 1234,
    "filesAnalyzed": 2
  }
}
```

## Use Cases

### 1. Audit Item Evaluation (Current)

```javascript
const context = `
**AUDIT ITEM INFORMATION:**
Code: 3.13.11
Title: Employ FIPS-validated cryptography...
Applicability: Applicable

**Description:**
Cryptography can be employed to support many security solutions...

**Discussion:**
The security objectives...
`;

const files = [
  {
    name: "evidence.pdf",
    mimeType: "application/pdf",
    data: "base64...",
    encoding: "base64"
  }
];

fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ context, files })
});
```

### 2. Policy Compliance Check

```javascript
const context = `
**POLICY COMPLIANCE REVIEW:**

Policy: Data Protection and Privacy Policy
Version: 2.0
Department: IT Security

**Policy Requirements:**
1. All personal data must be encrypted at rest
2. Access logs must be maintained for 90 days
3. Data retention period: 5 years

**Current Implementation:**
We have implemented AES-256 encryption for all databases...
`;

const files = [
  {
    name: "implementation-report.txt",
    mimeType: "text/plain",
    data: "Implementation details...",
    encoding: "text"
  }
];
```

### 3. Code Review Evaluation

```javascript
const context = `
**CODE REVIEW REQUEST:**

Repository: authentication-service
Branch: feature/oauth2-implementation
Developer: John Doe

**Changes:**
- Implemented OAuth2 authentication flow
- Added JWT token validation
- Integrated with identity provider

**Security Considerations:**
- Token expiration: 1 hour
- Refresh token rotation enabled
- HTTPS enforced for all endpoints
`;

const files = [
  {
    name: "code-diff.txt",
    mimeType: "text/plain",
    data: "diff --git a/src/auth...",
    encoding: "text"
  }
];
```

### 4. Risk Assessment

```javascript
const context = `
**RISK ASSESSMENT:**

Project: Cloud Migration Initiative
Risk Category: Security & Compliance

**Identified Risks:**
1. Data exposure during migration
2. Downtime impact on business operations
3. Third-party vendor dependency

**Mitigation Measures:**
- End-to-end encryption during transfer
- Phased migration approach
- Vendor SLA agreements in place
`;
```

### 5. Vendor Assessment

```javascript
const context = `
**VENDOR SECURITY ASSESSMENT:**

Vendor: CloudSecure Inc.
Service: Cloud Storage Platform
Contract Value: $500,000/year

**Security Certifications:**
- SOC 2 Type II
- ISO 27001
- GDPR Compliant

**Questionnaire Responses:**
${vendorResponses}
`;

const files = [
  {
    name: "security-certificate.pdf",
    mimeType: "application/pdf",
    data: "base64...",
    encoding: "base64"
  }
];
```

## File Object Structure

### Text Files
```json
{
  "name": "notes.txt",
  "mimeType": "text/plain",
  "description": "Additional notes",
  "data": "Plain text content here",
  "encoding": "text"
}
```

### Binary Files (PDF, Images, etc.)
```json
{
  "name": "document.pdf",
  "mimeType": "application/pdf",
  "description": "Supporting evidence",
  "data": "JVBERi0xLjQKJeLjz9MK...",
  "size": 234567,
  "encoding": "base64"
}
```

## Supported MIME Types

### Text Files (sent as plain text)
- `text/plain`
- `text/markdown`
- `application/json`
- `text/xml`
- `text/csv`

### Binary Files (sent as base64)
- `application/pdf`
- `application/msword`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `application/vnd.ms-excel`
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `image/jpeg`
- `image/png`
- `image/gif`
- `image/webp`

## Error Handling

### 400 Bad Request
```json
{
  "error": "Validation Error",
  "message": "context is required"
}
```

### 503 Service Unavailable
```json
{
  "error": "Service Unavailable",
  "message": "AI evaluation service is not configured"
}
```

### 500 Internal Server Error
```json
{
  "error": "Evaluation Failed",
  "message": "AI Evaluation failed: ...",
  "details": "The AI evaluation service encountered an error..."
}
```

## Rate Limiting

- **Default:** No rate limiting currently implemented
- **Recommendation:** Implement rate limiting based on your usage patterns
- **Gemini API Limits:** Check Google's Gemini API quotas

## Best Practices

1. **Context:**
   - Be specific and clear
   - Include all relevant information
   - Structure your context for readability
   - Keep context under 20,000 characters for best performance

2. **Files:**
   - Limit file sizes (recommended: < 5MB per file)
   - Use descriptive file names
   - Provide file descriptions
   - Maximum recommended: 5 files per request

3. **Performance:**
   - Larger files = longer processing time
   - Text files are processed faster than PDFs
   - Expect 5-30 seconds response time depending on complexity

4. **Security:**
   - Don't send sensitive data unless necessary
   - Ensure HTTPS is used
   - Implement authentication for production use

## cURL Examples

### Simple Text Evaluation
```bash
curl -X POST https://muraji-api.wathbahs.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "context": "Evaluate this security policy implementation...",
    "files": []
  }'
```

### With Files
```bash
curl -X POST https://muraji-api.wathbahs.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "context": "Review the attached security audit report...",
    "files": [
      {
        "name": "report.txt",
        "mimeType": "text/plain",
        "data": "Security audit findings: ...",
        "encoding": "text"
      }
    ]
  }'
```

## JavaScript/TypeScript Example

```typescript
interface EvaluationRequest {
  context: string;
  files: Array<{
    name: string;
    mimeType: string;
    description?: string;
    data: string;
    size?: number;
    encoding: 'text' | 'base64';
  }>;
}

interface EvaluationResponse {
  success: boolean;
  evaluation: {
    status: string;
    score: number;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    summary: string;
    // ... other fields
  };
  metadata: {
    evaluatedAt: string;
    contextLength: number;
    filesAnalyzed: number;
  };
}

async function evaluateWithGemini(
  context: string,
  files: any[] = []
): Promise<EvaluationResponse> {
  const response = await fetch(
    'https://muraji-api.wathbahs.com/api/evaluations/audit-item',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, files })
    }
  );

  if (!response.ok) {
    throw new Error(`Evaluation failed: ${response.statusText}`);
  }

  return response.json();
}
```

## Benefits of General API

1. **Flexibility:** Use for any evaluation scenario
2. **Simplicity:** Just two parameters: `context` and `files`
3. **Reusability:** Same API for different use cases
4. **Scalability:** Easy to integrate into different systems
5. **Maintainability:** Single endpoint to maintain

## Migration from Old Format

If you were using the old format with `title`, `code`, `description`, etc., simply build a `context` string:

```javascript
// Old format
const oldRequest = {
  title: "My Title",
  code: "CODE-001",
  description: "Description...",
  files: [...]
};

// New format
const newRequest = {
  context: `
    Title: ${oldRequest.title}
    Code: ${oldRequest.code}
    Description: ${oldRequest.description}
  `,
  files: oldRequest.files
};
```
