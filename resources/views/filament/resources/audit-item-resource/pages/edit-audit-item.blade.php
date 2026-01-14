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
            console.log('🤖 Starting Gemini AI Evaluation...');
            
            // Show loading notification
            new FilamentNotification()
                .title('🤖 جاري تحليل العنصر...')
                .body('يتم تحليل العنصر باستخدام Gemini AI. قد يستغرق 10-30 ثانية.')
                .info()
                .duration(30000)
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

            console.log('📡 API:', apiUrl);
            console.log('📦 Data:', requestData.title, '-', requestData.code);
            console.log('📄 Evidence files:', requestData.fileNames.length);

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
                
                console.log(`✅ Response: ${response.status} in ${duration}ms`);
                
                const data = await response.json();
                
                return {
                    status: response.status,
                    ok: response.ok,
                    data: data,
                    duration: duration
                };
            })
            .then(({status, ok, data, duration}) => {
                if (ok && data.evaluation) {
                    const evaluation = data.evaluation;
                    console.log(`✅ Success! Score: ${evaluation.score}/100 - ${evaluation.compliance_status}`);
                    
                    // Save to database
                    $wire.call('saveGeminiEvaluation', evaluation);

                    // Show success notification
                    new FilamentNotification()
                        .title(`✅ اكتمل التحليل! (${Math.round(duration/1000)}s)`)
                        .success()
                        .body(`النتيجة: ${evaluation.score}/100 - ${evaluation.compliance_status}\n\n${evaluation.summary?.substring(0, 100)}...`)
                        .duration(15000)
                        .send();
                    
                } else {
                    console.error('❌ فشل التحليل:', data.message || data.error);
                    
                    new FilamentNotification()
                        .title('❌ فشل التحليل')
                        .danger()
                        .body(data.message || data.error || 'حدث خطأ في الحصول على التحليل')
                        .duration(8000)
                        .send();
                }
            })
            .catch(error => {
                console.error('❌ خطأ:', error.message);
                
                new FilamentNotification()
                    .title('❌ خطأ في الاتصال')
                    .danger()
                    .body(`فشل الاتصال بخدمة الذكاء الاصطناعي.\n\nالخطأ: ${error.message}`)
                    .duration(10000)
                    .send();
            });
        };
        
        console.log('✅ Gemini evaluation script loaded and ready');
    </script>
</x-filament-panels::page>
