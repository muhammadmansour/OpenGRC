<x-filament-panels::page>
    {{ $this->form }}

    @if($geminiEvaluation)
        <div class="mt-4">
            @include('filament.components.gemini-evaluation-results', ['evaluation' => $geminiEvaluation])
        </div>
    @endif

    @script
    <script>
        // Use $wire to listen for Livewire events
        $wire.on('start-gemini-evaluation', () => {
            console.log('🎬 Received start-gemini-evaluation event');
            startGeminiEvaluation();
        });

        console.log('✅ Gemini evaluation listeners registered');

        function startGeminiEvaluation() {
            console.log('🚀 Starting Gemini Evaluation');
            
            // Show loading notification
            new FilamentNotification()
                .title('Starting AI Analysis...')
                .body('This may take 10-30 seconds. Please wait.')
                .info()
                .send();

            // Prepare the request data
            const auditItemId = {{ $record->id }};
            const apiUrl = '{{ config('services.evaluation_api.url', 'https://muraji-api.wathbahs.com') }}/api/evaluations/audit-item';

            const requestData = {
                title: @js($record->auditable->title ?? 'N/A'),
                code: @js($record->auditable->code ?? 'N/A'),
                description: @js(strip_tags($record->auditable->description ?? '')),
                discussion: @js(strip_tags($record->auditable->discussion ?? '')),
                applicability: @js($record->applicability?->value ?? 'Not specified'),
                fileNames: [],
                fileContents: []
            };

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

            console.log('📡 API URL:', apiUrl);
            console.log('📦 Request Data:', requestData);

            // Make the API call
            fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(requestData),
                mode: 'cors',
                credentials: 'omit'
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
                    
                    // Save via Livewire
                    $wire.call('saveGeminiEvaluation', evaluation);

                    // Show success
                    new FilamentNotification()
                        .title('✅ AI Evaluation Complete!')
                        .success()
                        .body(`Score: ${evaluation.score || 'N/A'}/100`)
                        .duration(10000)
                        .send();
                    
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
                
                let errorMessage = 'Failed to connect to AI service: ' + error.message;
                
                if (error.message === 'Failed to fetch') {
                    errorMessage = 'Cannot reach API server at ' + apiUrl;
                }
                
                new FilamentNotification()
                    .title('❌ Network Error')
                    .danger()
                    .body(errorMessage)
                    .duration(10000)
                    .send();
            });
        }
    </script>
    @endscript
</x-filament-panels::page>
