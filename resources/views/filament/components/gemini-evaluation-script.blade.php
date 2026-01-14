<script>
    function startGeminiEvaluation() {
        // Show loading notification
        const loadingNotification = new FilamentNotification()
            .title('Starting AI Analysis...')
            .body('This may take 10-30 seconds. Please wait.')
            .info()
            .send();

        // Prepare the request data
        const auditItemId = {{ $auditItemId }};
        const apiUrl = '{{ $apiUrl }}/api/evaluations/audit-item';

        // Gather audit item data from the page
        const requestData = {
            title: @js($record->auditable->title ?? 'N/A'),
            code: @js($record->auditable->code ?? 'N/A'),
            description: @js(strip_tags($record->auditable->description ?? '')),
            discussion: @js(strip_tags($record->auditable->discussion ?? '')),
            applicability: @js($record->applicability?->value ?? 'Not specified'),
            fileNames: [],
            fileContents: []
        };

        // Add evidence from data requests
        @php
            $fileNames = [];
            $fileContents = [];
            foreach ($record->dataRequests as $request) {
                foreach ($request->responses as $response) {
                    if ($response->status === \App\Enums\ResponseStatus::RESPONDED) {
                        if (!empty($response->response)) {
                            $fileNames[] = "Response to {$request->code}";
                            $fileContents[] = strip_tags($response->response);
                        }
                        if (!empty($response->files)) {
                            $files = json_decode($response->files, true);
                            if (is_array($files)) {
                                foreach ($files as $file) {
                                    $fileNames[] = basename($file);
                                    $fileContents[] = "File submitted: " . basename($file);
                                }
                            }
                        }
                    }
                }
            }
        @endphp

        requestData.fileNames = @js($fileNames);
        requestData.fileContents = @js($fileContents);

        console.log('🚀 Starting Gemini Evaluation:', requestData);
        console.log('📡 API URL:', apiUrl);

        // Make the API call
        fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(requestData)
        })
        .then(response => {
            console.log('📥 Response Status:', response.status);
            return response.json().then(data => ({
                status: response.status,
                ok: response.ok,
                data: data
            }));
        })
        .then(({status, ok, data}) => {
            console.log('📊 Response Data:', data);

            if (ok && data.evaluation) {
                const evaluation = data.evaluation;
                
                // Save the evaluation via Livewire
                @this.call('saveGeminiEvaluation', evaluation);

                // Show success notification with modal
                new FilamentNotification()
                    .title('✅ AI Evaluation Complete!')
                    .success()
                    .body(`Score: ${evaluation.score || 'N/A'}/100\n\n${evaluation.summary || ''}`)
                    .duration(10000)
                    .send();

                // Show detailed results modal
                showEvaluationModal(evaluation);
                
            } else {
                console.error('❌ API Error:', data);
                new FilamentNotification()
                    .title('❌ Evaluation Failed')
                    .danger()
                    .body(data.message || 'Failed to get evaluation from AI service')
                    .duration(8000)
                    .send();
            }
        })
        .catch(error => {
            console.error('❌ Fetch Error:', error);
            new FilamentNotification()
                .title('❌ Network Error')
                .danger()
                .body('Failed to connect to AI service: ' + error.message)
                .duration(8000)
                .send();
        });
    }

    function showEvaluationModal(evaluation) {
        // Create modal content
        const modalContent = `
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-success-50 dark:bg-success-900/20 p-4 rounded-lg">
                        <div class="text-xs text-success-600 dark:text-success-400 font-semibold mb-1">Overall Score</div>
                        <div class="text-3xl font-bold text-success-700 dark:text-success-300">${evaluation.score || 'N/A'}/100</div>
                    </div>
                    <div class="bg-primary-50 dark:bg-primary-900/20 p-4 rounded-lg">
                        <div class="text-xs text-primary-600 dark:text-primary-400 font-semibold mb-1">Compliance Status</div>
                        <div class="text-lg font-bold text-primary-700 dark:text-primary-300">${evaluation.compliance_status || 'N/A'}</div>
                    </div>
                </div>

                <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <h4 class="font-semibold text-sm mb-2">Summary</h4>
                    <p class="text-sm text-gray-700 dark:text-gray-300">${evaluation.summary || 'No summary available'}</p>
                </div>

                <div class="space-y-3">
                    <div>
                        <h4 class="font-semibold text-sm mb-2 text-success-700 dark:text-success-300">✅ Strengths</h4>
                        <ul class="list-disc list-inside text-sm space-y-1">
                            ${(evaluation.strengths || []).map(s => `<li class="text-gray-700 dark:text-gray-300">${s}</li>`).join('')}
                        </ul>
                    </div>

                    <div>
                        <h4 class="font-semibold text-sm mb-2 text-warning-700 dark:text-warning-300">⚠️ Weaknesses</h4>
                        <ul class="list-disc list-inside text-sm space-y-1">
                            ${(evaluation.weaknesses || []).map(w => `<li class="text-gray-700 dark:text-gray-300">${w}</li>`).join('')}
                        </ul>
                    </div>

                    <div>
                        <h4 class="font-semibold text-sm mb-2 text-primary-700 dark:text-primary-300">💡 Recommendations</h4>
                        <ul class="list-disc list-inside text-sm space-y-1">
                            ${(evaluation.recommendations || []).map(r => `<li class="text-gray-700 dark:text-gray-300">${r}</li>`).join('')}
                        </ul>
                    </div>
                </div>

                <div class="bg-info-50 dark:bg-info-900/20 p-3 rounded text-xs text-info-700 dark:text-info-300">
                    <strong>Note:</strong> ${evaluation.note || 'This is an AI-generated evaluation and should be reviewed by qualified personnel.'}
                </div>
            </div>
        `;

        // For now, just show in console (Filament modals need proper setup)
        console.log('📋 Evaluation Results:', evaluation);
        
        // You can integrate with Filament's modal system here
        // For now, the notification will show the summary
    }
</script>

<script>
    // Livewire method to save evaluation
    Livewire.on('evaluationSaved', () => {
        console.log('✅ Evaluation saved to database');
    });
</script>
