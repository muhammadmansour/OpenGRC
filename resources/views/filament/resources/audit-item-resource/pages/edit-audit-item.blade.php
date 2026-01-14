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

            // Build context string
            const title = @js($record->auditable->title ?? 'N/A');
            const code = @js($record->auditable->code ?? 'N/A');
            const description = @js(strip_tags($record->auditable->description ?? ''));
            const discussion = @js(strip_tags($record->auditable->discussion ?? ''));
            const applicability = @js($record->applicability?->value ?? 'Not specified');

            const context = `
**AUDIT ITEM INFORMATION:**

Code: ${code}
Title: ${title}
Applicability: ${applicability}

**Description:**
${description || 'No description provided'}

**Discussion:**
${discussion || 'No discussion provided'}

**Requirements:**
Please evaluate this audit item based on the information and evidence provided above.
`.trim();

            const requestData = {
                context: context,
                files: [] // Will contain {name, mimeType, data, encoding} objects
            };

            @php
                $files = [];
                
                foreach ($record->dataRequests as $request) {
                    foreach ($request->responses as $response) {
                        if ($response->status === \App\Enums\ResponseStatus::RESPONDED) {
                            // Add text response as evidence (as a virtual "file")
                            if (!empty($response->response)) {
                                $files[] = [
                                    'name' => "Response to {$request->code}.txt",
                                    'mimeType' => 'text/plain',
                                    'description' => "Text response to data request {$request->code}",
                                    'data' => strip_tags($response->response),
                                    'encoding' => 'text'
                                ];
                            }
                            
                            // Add actual file contents from attachments
                            foreach ($response->attachments as $attachment) {
                                try {
                                    $filePath = $attachment->file_path;
                                    $fileName = $attachment->file_name ?? basename($filePath);
                                    $fileDescription = $attachment->description ?? '';
                                    
                                    // Get storage disk
                                    $disk = \Illuminate\Support\Facades\Storage::disk(setting('storage.driver', config('filesystems.default')));
                                    
                                    // Try to read file content from storage
                                    if ($disk->exists($filePath)) {
                                        $content = $disk->get($filePath);
                                        $fileSize = $disk->size($filePath);
                                        $mimeType = $disk->mimeType($filePath);
                                        
                                        // Check file extension
                                        $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
                                        
                                        if (in_array($extension, ['txt', 'md', 'json', 'xml', 'csv'])) {
                                            // Text files - send as text
                                            $files[] = [
                                                'name' => $fileName,
                                                'mimeType' => $mimeType,
                                                'description' => $fileDescription,
                                                'data' => $content,
                                                'encoding' => 'text'
                                            ];
                                        } else {
                                            // Binary files (PDF, images, etc) - send as base64
                                            $files[] = [
                                                'name' => $fileName,
                                                'mimeType' => $mimeType,
                                                'description' => $fileDescription,
                                                'data' => base64_encode($content),
                                                'size' => $fileSize,
                                                'encoding' => 'base64'
                                            ];
                                        }
                                    } else {
                                        // File not found - send error info
                                        $files[] = [
                                            'name' => $fileName,
                                            'mimeType' => 'text/plain',
                                            'description' => $fileDescription,
                                            'data' => "ERROR: File not found in storage: {$filePath}",
                                            'encoding' => 'text'
                                        ];
                                    }
                                } catch (\Exception $e) {
                                    // Error reading file - send error info
                                    $files[] = [
                                        'name' => $fileName ?? 'unknown',
                                        'mimeType' => 'text/plain',
                                        'description' => $fileDescription ?? '',
                                        'data' => "ERROR: " . $e->getMessage(),
                                        'encoding' => 'text'
                                    ];
                                }
                            }
                        }
                    }
                }
            @endphp

            requestData.files = @js($files);

            console.log('📡 API:', apiUrl);
            console.log('📦 Item:', code, '-', title);
            console.log('📄 Context length:', context.length, 'chars');
            console.log('📎 Files:', requestData.files.length);
            
            if (requestData.files.length > 0) {
                console.log('📂 Files being sent to Gemini:');
                requestData.files.forEach((file, index) => {
                    const sizeInfo = file.size ? ` (${(file.size / 1024).toFixed(2)} KB)` : '';
                    const encodingInfo = file.encoding === 'base64' ? ' [BASE64]' : ' [TEXT]';
                    console.log(`  ${index + 1}. ${file.name}${sizeInfo}${encodingInfo}`);
                    console.log(`      Type: ${file.mimeType}`);
                    if (file.description) {
                        console.log(`      Desc: ${file.description}`);
                    }
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
