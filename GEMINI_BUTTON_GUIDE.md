# بدأ التحليل (Start Analysis) Button - User Guide

## Overview

A new **"بدأ التحليل"** (Start Analysis) button has been added to the Audit Item edit page. This button uses Google Gemini AI to automatically evaluate audit items and provide comprehensive compliance assessments.

## Setup

### 1. Run Database Migration

```bash
php artisan migrate
```

This adds three new columns to the `audit_items` table:
- `ai_evaluation` - Stores the full JSON evaluation from Gemini
- `ai_evaluation_score` - Stores the numerical score (0-100)
- `ai_evaluation_at` - Timestamp of when evaluation was performed

### 2. Configure Environment Variables

Add to your `.env` file:

```env
# Gemini AI Evaluation API
EVALUATION_API_URL=https://muraji-api.wathbahs.com
EVALUATION_API_TIMEOUT=60
```

### 3. Ensure API is Running

Make sure your Node.js evaluation API is deployed and running at:
- **Production**: https://muraji-api.wathbahs.com
- **Local Dev**: http://localhost:2020

## How to Use

### Step 1: Navigate to Audit Item

1. Go to an Audit
2. Click on any Audit Item to edit/assess it
3. You'll see the "Audit Evidence" section showing:
   - Associated Implementations
   - Associated Data Requests (evidence responses)

### Step 2: Click "بدأ التحليل" Button

1. In the top right corner, click the **"بدأ التحليل"** button (green button with sparkle icon)
2. A confirmation modal will appear
3. Click **"Start Analysis"** to begin

### Step 3: Wait for Results

- The AI analysis typically takes **10-30 seconds**
- Do not close the page during analysis
- A notification will appear when complete

### Step 4: View Results

After analysis completes:
- A success notification shows the score
- Click **"View AI Results"** button to see full evaluation

## What Gets Analyzed

The AI analyzes:

1. **Audit Item Information**:
   - Title
   - Code
   - Description
   - Discussion
   - Applicability

2. **Evidence Files**:
   - Data Request responses
   - Attached files
   - Response text

## Evaluation Results Include

The AI provides:

### Compliance Metrics
- **Score**: 0-100 numerical rating
- **Status**: Fully Compliant | Partially Compliant | Non-Compliant
- **Effectiveness**: Highly Effective | Effective | Partially Effective | Ineffective
- **Compliance Level**: High | Medium | Low
- **Risk Assessment**: Low | Medium | High

### Analysis Details
- **Summary**: Brief overall assessment
- **Detailed Analysis**: Comprehensive evaluation
- **Strengths**: What's working well
- **Weaknesses**: Areas needing improvement
- **Recommendations**: Actionable suggestions
- **Evidence Quality**: Excellent | Good | Adequate | Poor
- **Next Steps**: Suggested actions

## Example Workflow

```
1. Auditor requests evidence from stakeholder
   └─> Data Request created with due date

2. Stakeholder responds with documents/files
   └─> Response attached to Data Request

3. Auditor clicks "بدأ التحليل"
   └─> AI analyzes item + evidence

4. Results appear in modal
   └─> Score: 85/100
   └─> Status: Partially Compliant
   └─> 3 Strengths, 2 Weaknesses, 5 Recommendations

5. Auditor reviews AI suggestions
   └─> Updates Auditor Notes
   └─> Sets final Effectiveness rating
   └─> Saves assessment
```

## Button Location

The button appears in the **header actions** area alongside:
- **Back to Audit** - Return to audit overview
- **Get AI Suggestions** - Get implementation suggestions (if enabled)
- **AI Check Implementations** - Check implementation coverage (if enabled)
- **Request Evidence** - Send evidence request to users
- **بدأ التحليل** - NEW: AI evaluation button
- **View AI Results** - View previous evaluation (if exists)

## Features

### ✅ Automatic Evidence Collection
- Automatically gathers all evidence from Data Request responses
- Includes both text responses and file attachments
- No manual data entry required

### ✅ Comprehensive Analysis
- Uses Google Gemini 1.5 Flash AI model
- Provides detailed, actionable feedback
- Evaluates against compliance standards

### ✅ Saved Results
- Results are saved to database
- Can be reviewed anytime using "View AI Results" button
- Includes timestamp of when evaluation was performed

### ✅ Re-evaluation Support
- Can re-run analysis as evidence is updated
- Previous results are overwritten with new evaluation
- Useful for tracking improvement over time

## Troubleshooting

### Button is Greyed Out / Not Working

**Issue**: Button doesn't respond or shows error

**Solutions**:
1. Check API URL in `.env` is correct
2. Verify API is running: `curl https://muraji-api.wathbahs.com/health`
3. Check browser console for error messages
4. Ensure you have internet connection

### "Service Unavailable" Error

**Issue**: API returns 503 error

**Cause**: Gemini API key not configured on API server

**Solution**: Contact system administrator to configure `GEMINI_API_KEY` on API server

### Slow Response

**Issue**: Analysis takes very long

**Normal**: AI processing can take 10-30 seconds
**Abnormal**: If >60 seconds, there may be a timeout issue

**Solutions**:
1. Check API server logs
2. Verify network connection
3. Try again (may be temporary API slowdown)

### No Evidence Found

**Issue**: Evaluation says "No files submitted"

**Reason**: No Data Request responses with evidence

**Solution**: 
1. Create Data Request
2. Have stakeholder respond with evidence
3. Then run evaluation

### "View AI Results" Button Not Showing

**Issue**: Can't see previous results

**Reason**: No evaluation has been run yet

**Solution**: Click "بدأ التحليل" first to generate evaluation

## Technical Details

### API Endpoint Used
```
POST https://muraji-api.wathbahs.com/api/evaluations/audit-item
```

### Request Payload
```json
{
  "title": "Item title",
  "code": "3.13.11",
  "description": "Item description",
  "discussion": "Implementation discussion",
  "applicability": "Applicable",
  "fileNames": ["response1.pdf", "evidence.docx"],
  "fileContents": ["Content of file 1...", "Content of file 2..."]
}
```

### Response Structure
```json
{
  "success": true,
  "evaluation": {
    "score": 92,
    "status": "Fully Compliant",
    "complianceLevel": "high",
    "effectiveness": "Highly Effective",
    "strengths": [...],
    "weaknesses": [...],
    "recommendations": [...],
    // ... more fields
  }
}
```

### Database Storage
Results are stored in JSON format in `audit_items.ai_evaluation`

Access programmatically:
```php
$auditItem->ai_evaluation // JSON string
$auditItem->ai_evaluation_score // Integer 0-100
$auditItem->ai_evaluation_at // Carbon timestamp
```

## Best Practices

1. **Request Evidence First**: Always request and collect evidence before running evaluation
2. **Review AI Suggestions**: Use AI results as guidance, not final decision
3. **Add Auditor Notes**: Supplement AI evaluation with your professional judgment
4. **Re-evaluate After Changes**: Run analysis again if significant evidence is added
5. **Use Results for Discussion**: Share AI findings with stakeholders for remediation planning

## Security & Privacy

- ✅ All API calls are authenticated
- ✅ Evidence data is sent over HTTPS
- ✅ Results are stored securely in database
- ✅ Only authorized users can access evaluations
- ✅ Gemini AI follows Google's privacy policies

## Support

For issues or questions:
- Check API status: https://muraji-api.wathbahs.com/health
- View API docs: https://muraji-api.wathbahs.com/docs
- Contact system administrator

## Version

- **Added**: January 14, 2026
- **API Version**: 1.0.0
- **AI Model**: Google Gemini 1.5 Flash

---

**Ready to use!** Navigate to any Audit Item and click **بدأ التحليل** to start your first AI evaluation! 🚀
