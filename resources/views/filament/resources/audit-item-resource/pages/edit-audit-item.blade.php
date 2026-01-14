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
                            // Add text response as evidence
                            if (!empty($response->response)) {
                                $fileNames[] = "Response to {$request->code}";
                                $fileContents[] = strip_tags($response->response);
                            }
                            
                            // Add actual file contents from attachments
                            foreach ($response->attachments as $attachment) {
                                try {
                                    $filePath = $attachment->file_path;
                                    $fileName = $attachment->file_name ?? basename($filePath);
                                    $fileDescription = $attachment->description ?? '';
                                    
                                    $fileNames[] = $fileName;
                                    
                                    // Get storage disk
                                    $disk = \Illuminate\Support\Facades\Storage::disk(setting('storage.driver', config('filesystems.default')));
                                    
                                    // Try to read file content from storage
                                    if ($disk->exists($filePath)) {
                                        $content = $disk->get($filePath);
                                        $fileSize = $disk->size($filePath);
                                        
                                        // Check file extension to determine how to handle it
                                        $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
                                        
                                        if (in_array($extension, ['txt', 'md', 'json', 'xml', 'csv'])) {
                                            // Text files - send as-is
                                            $fileContents[] = "File: {$fileName}\nDescription: {$fileDescription}\n\nContent:\n{$content}";
                                        } elseif (in_array($extension, ['pdf', 'doc', 'docx', 'xls', 'xlsx'])) {
                                            // Binary/document files - send metadata + description
                                            $fileContents[] = "Document: {$fileName}\nType: {$extension}\nSize: " . number_format($fileSize / 1024, 2) . " KB\nDescription: {$fileDescription}\n\nNote: This is a {$extension} document submitted as evidence. The actual document content cannot be extracted automatically, but the file has been uploaded and is available for manual review.";
                                        } elseif (in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) {
                                            // Image files - send description only (Gemini can't process images via text API)
                                            $fileContents[] = "Image: {$fileName}\nType: {$extension}\nSize: " . number_format($fileSize / 1024, 2) . " KB\nDescription: {$fileDescription}\n\nNote: This is an image file submitted as evidence.";
                                        } else {
                                            // Other files - send basic info
                                            $fileContents[] = "File: {$fileName}\nType: {$extension}\nSize: " . number_format($fileSize / 1024, 2) . " KB\nDescription: {$fileDescription}";
                                        }
                                    } else {
                                        // File not found in storage
                                        $fileContents[] = "File: {$fileName}\nStatus: Not found in storage\nDescription: {$fileDescription}";
                                    }
                                } catch (\Exception $e) {
                                    // Error reading file
                                    $fileContents[] = "File: {$fileName}\nError: " . $e->getMessage();
                                }
                            }
                        }
                    }
                }
            @endphp

            requestData.fileNames = @js($fileNames);
            requestData.fileContents = @js($fileContents);

            console.log('📡 API:', apiUrl);
            console.log('📦 Audit Item:', requestData.title, '-', requestData.code);
            console.log('📄 Evidence count:', requestData.fileNames.length);
            
            if (requestData.fileNames.length > 0) {
                console.log('📂 Files being sent:');
                requestData.fileNames.forEach((name, index) => {
                    const contentPreview = requestData.fileContents[index]?.substring(0, 100);
                    console.log(`  ${index + 1}. ${name} (${requestData.fileContents[index]?.length || 0} chars)`);
                });
            }

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
