# Frontend Integration Guide - Gemini Evaluation Modal

## Overview

This guide shows how to integrate the Gemini AI evaluation into your Filament audit interface to display evaluations in a modal.

## Laravel Filament Integration

### Step 1: Create Livewire Component for Evaluation Modal

```php
<?php
// app/Livewire/AuditEvaluationModal.php

namespace App\Livewire;

use Livewire\Component;
use Illuminate\Support\Facades\Http;

class AuditEvaluationModal extends Component
{
    public $auditItemId;
    public $showModal = false;
    public $isLoading = false;
    public $evaluation = null;
    public $error = null;

    // Audit item data
    public $title;
    public $code;
    public $description;
    public $discussion;
    public $applicability;
    public $evidenceFiles = [];

    protected $listeners = ['evaluateAuditItem'];

    public function evaluateAuditItem($auditItemId)
    {
        $this->auditItemId = $auditItemId;
        $this->loadAuditItem();
        $this->showModal = true;
        $this->performEvaluation();
    }

    protected function loadAuditItem()
    {
        // Load audit item from your database
        // This is example code - adjust to your model structure
        $auditItem = \App\Models\AuditItem::find($this->auditItemId);
        
        $this->title = $auditItem->title;
        $this->code = $auditItem->code;
        $this->description = $auditItem->description;
        $this->discussion = $auditItem->discussion;
        $this->applicability = $auditItem->applicability;
        
        // Load evidence files
        $this->evidenceFiles = $auditItem->evidenceFiles()
            ->get()
            ->map(function ($file) {
                return [
                    'name' => $file->name,
                    'content' => $this->extractFileText($file->path)
                ];
            })
            ->toArray();
    }

    protected function extractFileText($filePath)
    {
        // Extract text from file - implement based on file types
        // For PDFs, you might use smalot/pdfparser
        // For DOCX, you might use phpoffice/phpword
        if (file_exists($filePath)) {
            $extension = pathinfo($filePath, PATHINFO_EXTENSION);
            
            if ($extension === 'txt') {
                return file_get_contents($filePath);
            }
            // Add more file type handlers as needed
        }
        
        return "File content not available";
    }

    public function performEvaluation()
    {
        $this->isLoading = true;
        $this->evaluation = null;
        $this->error = null;

        try {
            $response = Http::timeout(60)
                ->withHeaders([
                    'Authorization' => 'Bearer ' . auth()->user()->api_token,
                    'userid' => auth()->id()
                ])
                ->post(config('services.evaluation_api.url') . '/api/evaluations/audit-item', [
                    'title' => $this->title,
                    'code' => $this->code,
                    'description' => $this->description,
                    'discussion' => $this->discussion,
                    'applicability' => $this->applicability,
                    'fileNames' => array_column($this->evidenceFiles, 'name'),
                    'fileContents' => array_column($this->evidenceFiles, 'content'),
                ]);

            if ($response->successful()) {
                $data = $response->json();
                $this->evaluation = $data['evaluation'];
                
                // Optionally save evaluation to database
                $this->saveEvaluation();
            } else {
                $this->error = 'Failed to get evaluation: ' . $response->json()['message'];
            }
        } catch (\Exception $e) {
            $this->error = 'Error: ' . $e->getMessage();
            \Log::error('Evaluation API error:', ['error' => $e->getMessage()]);
        } finally {
            $this->isLoading = false;
        }
    }

    protected function saveEvaluation()
    {
        if ($this->evaluation) {
            \App\Models\AuditItem::find($this->auditItemId)->update([
                'ai_evaluation' => $this->evaluation,
                'compliance_score' => $this->evaluation['score'],
                'compliance_status' => $this->evaluation['status'],
                'evaluated_at' => now(),
            ]);
        }
    }

    public function closeModal()
    {
        $this->showModal = false;
        $this->evaluation = null;
        $this->error = null;
    }

    public function render()
    {
        return view('livewire.audit-evaluation-modal');
    }
}
```

### Step 2: Create Blade View for Modal

```php
<!-- resources/views/livewire/audit-evaluation-modal.blade.php -->

<div>
    @if($showModal)
    <div class="fixed inset-0 z-50 overflow-y-auto" wire:key="evaluation-modal">
        <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <!-- Background overlay -->
            <div class="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" wire:click="closeModal"></div>

            <!-- Modal panel -->
            <div class="inline-block w-full max-w-4xl overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle">
                <!-- Header -->
                <div class="px-6 py-4 bg-blue-600 text-white">
                    <div class="flex items-center justify-between">
                        <h3 class="text-lg font-medium">
                            AI Evaluation Results
                        </h3>
                        <button wire:click="closeModal" class="text-white hover:text-gray-200">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <p class="mt-1 text-sm text-blue-100">{{ $code }} - {{ $title }}</p>
                </div>

                <!-- Content -->
                <div class="px-6 py-4 max-h-[70vh] overflow-y-auto">
                    @if($isLoading)
                        <!-- Loading State -->
                        <div class="flex flex-col items-center justify-center py-12">
                            <svg class="w-16 h-16 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p class="mt-4 text-lg text-gray-700">Analyzing with AI...</p>
                            <p class="mt-2 text-sm text-gray-500">This may take 10-30 seconds</p>
                        </div>
                    @elseif($error)
                        <!-- Error State -->
                        <div class="p-4 bg-red-50 border border-red-200 rounded-lg">
                            <div class="flex items-start">
                                <svg class="w-6 h-6 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div>
                                    <h4 class="text-red-800 font-medium">Evaluation Failed</h4>
                                    <p class="mt-1 text-red-700 text-sm">{{ $error }}</p>
                                </div>
                            </div>
                        </div>
                    @elseif($evaluation)
                        <!-- Evaluation Results -->
                        
                        <!-- Score Badge -->
                        <div class="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                            <div class="flex items-center justify-between">
                                <div>
                                    <h4 class="text-sm font-medium text-gray-500">Compliance Score</h4>
                                    <p class="mt-2 text-4xl font-bold text-blue-600">{{ $evaluation['score'] }}/100</p>
                                </div>
                                <div class="text-right">
                                    <span class="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium
                                        @if($evaluation['complianceLevel'] === 'high') bg-green-100 text-green-800
                                        @elseif($evaluation['complianceLevel'] === 'medium') bg-yellow-100 text-yellow-800
                                        @else bg-red-100 text-red-800
                                        @endif">
                                        {{ $evaluation['status'] }}
                                    </span>
                                    <p class="mt-2 text-sm text-gray-600">{{ $evaluation['effectiveness'] }}</p>
                                </div>
                            </div>
                        </div>

                        <!-- Summary -->
                        <div class="mb-6">
                            <h4 class="text-lg font-semibold text-gray-900 mb-2">Summary</h4>
                            <p class="text-gray-700">{{ $evaluation['summary'] }}</p>
                        </div>

                        <!-- Detailed Analysis -->
                        <div class="mb-6">
                            <h4 class="text-lg font-semibold text-gray-900 mb-2">Detailed Analysis</h4>
                            <div class="prose max-w-none text-gray-700">
                                {!! nl2br(e($evaluation['detailedAnalysis'])) !!}
                            </div>
                        </div>

                        <!-- Strengths -->
                        @if(!empty($evaluation['strengths']))
                        <div class="mb-6">
                            <h4 class="text-lg font-semibold text-gray-900 mb-3">✓ Strengths</h4>
                            <ul class="space-y-2">
                                @foreach($evaluation['strengths'] as $strength)
                                <li class="flex items-start">
                                    <svg class="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                                    </svg>
                                    <span class="text-gray-700">{{ $strength }}</span>
                                </li>
                                @endforeach
                            </ul>
                        </div>
                        @endif

                        <!-- Weaknesses -->
                        @if(!empty($evaluation['weaknesses']))
                        <div class="mb-6">
                            <h4 class="text-lg font-semibold text-gray-900 mb-3">⚠ Areas for Improvement</h4>
                            <ul class="space-y-2">
                                @foreach($evaluation['weaknesses'] as $weakness)
                                <li class="flex items-start">
                                    <svg class="w-5 h-5 text-yellow-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                                    </svg>
                                    <span class="text-gray-700">{{ $weakness }}</span>
                                </li>
                                @endforeach
                            </ul>
                        </div>
                        @endif

                        <!-- Recommendations -->
                        @if(!empty($evaluation['recommendations']))
                        <div class="mb-6">
                            <h4 class="text-lg font-semibold text-gray-900 mb-3">💡 Recommendations</h4>
                            <ul class="space-y-2">
                                @foreach($evaluation['recommendations'] as $recommendation)
                                <li class="flex items-start">
                                    <svg class="w-5 h-5 text-blue-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                                    </svg>
                                    <span class="text-gray-700">{{ $recommendation }}</span>
                                </li>
                                @endforeach
                            </ul>
                        </div>
                        @endif

                        <!-- Metadata -->
                        <div class="pt-4 border-t border-gray-200">
                            <div class="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span class="text-gray-500">Evidence Quality:</span>
                                    <span class="ml-2 font-medium text-gray-900">{{ $evaluation['evidenceQuality'] }}</span>
                                </div>
                                <div>
                                    <span class="text-gray-500">Risk Assessment:</span>
                                    <span class="ml-2 font-medium text-gray-900">{{ ucfirst($evaluation['riskAssessment']) }}</span>
                                </div>
                                <div>
                                    <span class="text-gray-500">Evaluated:</span>
                                    <span class="ml-2 font-medium text-gray-900">{{ \Carbon\Carbon::parse($evaluation['evaluatedAt'])->diffForHumans() }}</span>
                                </div>
                                <div>
                                    <span class="text-gray-500">AI Model:</span>
                                    <span class="ml-2 font-medium text-gray-900">{{ $evaluation['aiModel'] }}</span>
                                </div>
                            </div>
                        </div>
                    @endif
                </div>

                <!-- Footer -->
                <div class="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <div class="flex justify-end space-x-3">
                        <button wire:click="closeModal" 
                                class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                            Close
                        </button>
                        @if($evaluation && !$isLoading)
                        <button wire:click="performEvaluation" 
                                class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700">
                            Re-evaluate
                        </button>
                        @endif
                    </div>
                </div>
            </div>
        </div>
    </div>
    @endif
</div>
```

### Step 3: Add Configuration

```php
// config/services.php

return [
    // ... other services

    'evaluation_api' => [
        'url' => env('EVALUATION_API_URL', 'https://muraji-api.wathbahs.com'),
        'timeout' => env('EVALUATION_API_TIMEOUT', 60),
    ],
];
```

```env
# .env
EVALUATION_API_URL=https://muraji-api.wathbahs.com
EVALUATION_API_TIMEOUT=60
```

### Step 4: Add Button to Filament Resource

```php
// app/Filament/Admin/Resources/AuditItemResource.php

use Filament\Tables\Actions\Action;

public static function table(Table $table): Table
{
    return $table
        ->columns([
            // ... your existing columns
        ])
        ->actions([
            Action::make('evaluate')
                ->label('AI Evaluate')
                ->icon('heroicon-o-sparkles')
                ->color('primary')
                ->action(function ($record) {
                    // Trigger Livewire component
                    $this->dispatch('evaluateAuditItem', $record->id);
                }),
            // ... other actions
        ]);
}
```

### Step 5: Include Component in Layout

```php
<!-- resources/views/filament/pages/audit-items.blade.php -->

<x-filament-panels::page>
    <!-- Your existing content -->
    
    <!-- Add the evaluation modal component -->
    @livewire('audit-evaluation-modal')
</x-filament-panels::page>
```

## JavaScript Integration (Alternative)

If you prefer pure JavaScript:

```javascript
async function evaluateAuditItem(itemId) {
    // Show loading modal
    showLoadingModal();
    
    try {
        // Fetch audit item data
        const itemData = await fetchAuditItemData(itemId);
        
        // Call evaluation API
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
                fileNames: itemData.files.map(f => f.name),
                fileContents: itemData.files.map(f => f.content)
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Show evaluation modal
            showEvaluationModal(result.evaluation);
        } else {
            showError(result.message);
        }
    } catch (error) {
        showError('Failed to evaluate: ' + error.message);
    }
}
```

## Testing

1. Start the API server:
```bash
cd api
npm run dev
```

2. Set your Gemini API key in `.env`:
```
GEMINI_API_KEY=your_key_here
```

3. Test from Laravel:
```bash
php artisan tinker
>>> $item = App\Models\AuditItem::first();
>>> app(App\Livewire\AuditEvaluationModal::class)->evaluateAuditItem($item->id);
```

## Security Considerations

1. **API Authentication**: Ensure your Node.js API validates the Laravel auth token
2. **Rate Limiting**: Implement rate limiting on the evaluation endpoint
3. **File Size Limits**: Limit file content size to prevent abuse
4. **CORS**: Configure CORS properly between Laravel and Node.js API
5. **Environment Variables**: Never expose API keys to frontend

## Next Steps

1. Add database migration for storing evaluations
2. Create audit trail for all evaluations
3. Add export functionality for evaluation reports
4. Implement comparison between multiple evaluations
5. Add scheduling for periodic re-evaluations

For more details, see `EVALUATION_API_GUIDE.md`
