<x-filament-panels::page>
    {{ $this->form }}

    @if($geminiEvaluation)
        <div class="mt-4">
            @include('filament.components.gemini-evaluation-results', ['evaluation' => $geminiEvaluation])
        </div>
    @endif

    <script>
        // Make function globally available
        window.startGeminiEvaluation = function() {
            console.log('═══════════════════════════════════════');
            console.log('🚀 Starting Gemini Evaluation from Filament');
            console.log('═══════════════════════════════════════');
            console.log('Function called at:', new Date().toISOString());
            console.log('');
            
            // Show loading notification
            try {
                new FilamentNotification()
                    .title('🤖 Starting AI Analysis...')
                    .body('Analyzing audit item with Gemini AI. This may take 10-30 seconds.')
                    .info()
                    .duration(30000)
                    .send();
                console.log('✅ Loading notification shown');
            } catch (e) {
                console.error('❌ Failed to show notification:', e);
            }

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
            console.log('📦 File count:', requestData.fileNames.length);
            console.log('');
            console.log('🚀 Sending fetch request...');

            const startTime = performance.now();

            // Make the API call (same as test page)
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
            .then(async response => {
                const endTime = performance.now();
                const duration = Math.round(endTime - startTime);
                
                console.log('');
                console.log(`✅ Response received in ${duration}ms`);
                console.log('📥 Status:', response.status, response.statusText);
                console.log('📥 OK:', response.ok);
                console.log('');
                console.log('📋 Response Headers:');
                for (let [key, value] of response.headers.entries()) {
                    console.log(`  ${key}: ${value}`);
                }
                console.log('');
                
                let data;
                try {
                    const text = await response.text();
                    console.log('📄 Raw Response (first 500 chars):');
                    console.log(text.substring(0, 500));
                    console.log('');
                    data = JSON.parse(text);
                    console.log('✅ JSON parsed successfully');
                } catch (e) {
                    console.error('❌ Failed to parse JSON:', e);
                    throw new Error('Invalid JSON response from server');
                }
                
                return {
                    status: response.status,
                    ok: response.ok,
                    data: data,
                    duration: duration
                };
            })
            .then(({status, ok, data, duration}) => {
                console.log('');
                console.log('📊 Processing Response Data...');
                console.log('Data structure:', Object.keys(data));
                console.log('');

                if (ok && data.success && data.evaluation) {
                    const evaluation = data.evaluation;
                    console.log('✅ SUCCESS! Evaluation received');
                    console.log('  Score:', evaluation.score);
                    console.log('  Compliance Status:', evaluation.compliance_status);
                    console.log('  Summary:', evaluation.summary?.substring(0, 100) + '...');
                    console.log('  Strengths:', evaluation.strengths?.length || 0);
                    console.log('  Weaknesses:', evaluation.weaknesses?.length || 0);
                    console.log('  Recommendations:', evaluation.recommendations?.length || 0);
                    console.log('');
                    
                    // Save via Livewire
                    console.log('💾 Saving evaluation to database via Livewire...');
                    $wire.call('saveGeminiEvaluation', evaluation);

                    // Show success
                    new FilamentNotification()
                        .title(`✅ AI Evaluation Complete! (${Math.round(duration/1000)}s)`)
                        .success()
                        .body(`Score: ${evaluation.score}/100 - ${evaluation.compliance_status}\n\n${evaluation.summary?.substring(0, 150)}...`)
                        .duration(15000)
                        .send();
                    
                    console.log('✅ All done!');
                    console.log('═══════════════════════════════════════');
                    
                } else if (ok && data.evaluation) {
                    // Handle case where success flag might be missing
                    const evaluation = data.evaluation;
                    console.log('✅ Evaluation received (no success flag)');
                    console.log('Score:', evaluation.score);
                    console.log('');
                    
                    $wire.call('saveGeminiEvaluation', evaluation);

                    new FilamentNotification()
                        .title('✅ AI Evaluation Complete!')
                        .success()
                        .body(`Score: ${evaluation.score || 'N/A'}/100`)
                        .duration(10000)
                        .send();
                } else {
                    console.error('❌ Unexpected response format');
                    console.error('Response data:', data);
                    console.log('═══════════════════════════════════════');
                    
                    new FilamentNotification()
                        .title('❌ Evaluation Failed')
                        .danger()
                        .body(data.message || data.error || 'Unexpected response format from AI service')
                        .duration(8000)
                        .send();
                }
            })
            .catch(error => {
                console.log('');
                console.error('❌ FETCH FAILED!');
                console.error('Error type:', error.name);
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
                console.log('═══════════════════════════════════════');
                
                let errorMessage = error.message;
                let errorTitle = '❌ Network Error';
                
                if (error.message === 'Failed to fetch') {
                    errorTitle = '❌ Cannot Reach API';
                    errorMessage = `Failed to connect to AI service.\n\n` +
                                  `URL: ${apiUrl}\n\n` +
                                  `This usually means:\n` +
                                  `• CORS preflight blocked\n` +
                                  `• Network/firewall issue\n` +
                                  `• API server stopped\n\n` +
                                  `Check browser Console for details.`;
                    
                    console.error('💡 Diagnosis: "Failed to fetch" typically means:');
                    console.error('  1. CORS preflight request was blocked');
                    console.error('  2. Network error (DNS, firewall, SSL)');
                    console.error('  3. Browser security policy blocking request');
                    console.error('');
                    console.error('💡 Check Network tab for:');
                    console.error('  • OPTIONS request status');
                    console.error('  • CORS headers in response');
                    console.error('  • Any blocked requests');
                    
                } else if (error.message.includes('JSON')) {
                    errorTitle = '❌ Invalid Response';
                    errorMessage = `Server returned invalid JSON.\n\nError: ${error.message}`;
                }
                
                new FilamentNotification()
                    .title(errorTitle)
                    .danger()
                    .body(errorMessage)
                    .duration(15000)
                    .send();
            });
        };
        
        console.log('✅ Gemini evaluation script loaded - window.startGeminiEvaluation() is ready');
    </script>
</x-filament-panels::page>
