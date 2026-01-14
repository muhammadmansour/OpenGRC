<x-filament-panels::page>
    {{ $this->form }}

    {{-- AI Evaluation Results Modal --}}
    <div id="ai-results-modal" class="fixed inset-0 z-50 hidden overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {{-- Background overlay --}}
            <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onclick="closeAiModal()"></div>

            {{-- Modal panel --}}
            <div class="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-right overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                {{-- Header --}}
                <div class="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
                    <div class="flex items-center justify-between">
                        <button onclick="closeAiModal()" class="text-white hover:text-gray-200">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <h3 class="text-xl font-bold text-white flex items-center">
                            <svg class="w-6 h-6 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            نتائج تحليل الذكاء الاصطناعي
                        </h3>
                    </div>
                </div>

                {{-- Content --}}
                <div id="ai-results-content" class="px-6 py-4 max-h-[70vh] overflow-y-auto">
                    {{-- Content will be injected by JavaScript --}}
                </div>

                {{-- Footer --}}
                <div class="bg-gray-50 dark:bg-gray-700 px-6 py-3 flex justify-end">
                    <button onclick="closeAiModal()" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition">
                        إغلاق
                    </button>
                </div>
            </div>
        </div>
    </div>

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
            const apiUrl = '{{ config('services.chat_api.url', 'https://muraji-api.wathbahs.com') }}/api/chat';

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
                if (ok && data.response) {
                    const evaluation = data.response;
                    console.log(`✅ Success! Score: ${evaluation.score}/100 - ${evaluation.compliance_status}`);
                    
                    // Show results in modal
                    showAiResultsModal(evaluation, duration);

                    // Show success notification
                    new FilamentNotification()
                        .title(`✅ اكتمل التحليل! (${Math.round(duration/1000)}s)`)
                        .success()
                        .body(`النتيجة: ${evaluation.score}/100 - ${evaluation.compliance_status}`)
                        .duration(5000)
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
        
        // Modal functions
        function showAiResultsModal(evaluation, duration) {
            const modal = document.getElementById('ai-results-modal');
            const content = document.getElementById('ai-results-content');
            
            // Generate styled HTML content
            content.innerHTML = generateEvaluationHTML(evaluation, duration);
            
            // Show modal
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
        
        function closeAiModal() {
            const modal = document.getElementById('ai-results-modal');
            modal.classList.add('hidden');
            document.body.style.overflow = 'auto';
        }
        
        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeAiModal();
        });
        
        function generateEvaluationHTML(eval, duration) {
            const scoreColor = eval.score >= 80 ? 'green' : eval.score >= 50 ? 'yellow' : 'red';
            const scoreColorClass = {
                green: 'from-green-500 to-green-600',
                yellow: 'from-yellow-500 to-yellow-600', 
                red: 'from-red-500 to-red-600'
            }[scoreColor];
            
            const statusBadge = {
                'Compliant': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
                'Partially Compliant': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
                'Non-Compliant': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
            }[eval.compliance_status] || 'bg-gray-100 text-gray-800';

            return `
                <div class="space-y-6" dir="rtl">
                    <!-- Score Card -->
                    <div class="bg-gradient-to-r ${scoreColorClass} rounded-xl p-6 text-white text-center">
                        <div class="text-6xl font-bold mb-2">${eval.score}<span class="text-3xl">/100</span></div>
                        <div class="text-xl">${eval.compliance_status}</div>
                        <div class="text-sm opacity-80 mt-2">تم التحليل في ${Math.round(duration/1000)} ثانية</div>
                    </div>
                    
                    <!-- Status Badges -->
                    <div class="flex flex-wrap gap-3 justify-center">
                        <span class="px-4 py-2 rounded-full text-sm font-medium ${statusBadge}">
                            ${eval.compliance_status}
                        </span>
                        <span class="px-4 py-2 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                            الفعالية: ${eval.effectiveness || 'N/A'}
                        </span>
                        <span class="px-4 py-2 rounded-full text-sm font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                            جودة الأدلة: ${eval.evidenceQuality || 'N/A'}
                        </span>
                        <span class="px-4 py-2 rounded-full text-sm font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300">
                            المخاطر: ${eval.riskAssessment || 'N/A'}
                        </span>
                    </div>
                    
                    <!-- Files Analyzed -->
                    ${eval.filesAnalyzed && eval.filesAnalyzed.length > 0 ? `
                    <div class="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-4">
                        <h4 class="font-bold text-lg mb-3 text-indigo-900 dark:text-indigo-100">📁 الملفات التي تم تحليلها</h4>
                        <div class="space-y-3">
                            ${eval.filesAnalyzed.map(f => `
                                <div class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-indigo-200 dark:border-indigo-700">
                                    <div class="font-medium text-indigo-800 dark:text-indigo-200">📄 ${f.filename}</div>
                                    <div class="text-sm text-gray-600 dark:text-gray-400 mt-1"><strong>المحتوى:</strong> ${f.description}</div>
                                    <div class="text-sm text-gray-600 dark:text-gray-400"><strong>الصلة:</strong> ${f.relevance}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    <!-- Summary -->
                    <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <h4 class="font-bold text-lg mb-2 text-gray-900 dark:text-white">📋 الملخص</h4>
                        <p class="text-gray-700 dark:text-gray-300">${eval.summary || 'لا يوجد ملخص'}</p>
                    </div>
                    
                    <!-- Detailed Analysis -->
                    ${eval.detailedAnalysis ? `
                    <div class="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                        <h4 class="font-bold text-lg mb-2 text-blue-900 dark:text-blue-100">🔍 التحليل التفصيلي</h4>
                        <p class="text-blue-800 dark:text-blue-200">${eval.detailedAnalysis}</p>
                    </div>
                    ` : ''}
                    
                    <!-- Two Column Layout -->
                    <div class="grid md:grid-cols-2 gap-4">
                        <!-- Strengths -->
                        <div class="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
                            <h4 class="font-bold text-lg mb-3 text-green-900 dark:text-green-100">✅ نقاط القوة</h4>
                            ${eval.strengths && eval.strengths.length > 0 ? `
                                <ul class="space-y-2">
                                    ${eval.strengths.map(s => `<li class="flex items-start"><span class="text-green-500 ml-2">•</span><span class="text-green-800 dark:text-green-200">${s}</span></li>`).join('')}
                                </ul>
                            ` : '<p class="text-green-600 dark:text-green-400 italic">لم يتم تحديد نقاط قوة</p>'}
                        </div>
                        
                        <!-- Weaknesses -->
                        <div class="bg-red-50 dark:bg-red-900/30 rounded-lg p-4">
                            <h4 class="font-bold text-lg mb-3 text-red-900 dark:text-red-100">⚠️ نقاط الضعف</h4>
                            ${eval.weaknesses && eval.weaknesses.length > 0 ? `
                                <ul class="space-y-2">
                                    ${eval.weaknesses.map(w => `<li class="flex items-start"><span class="text-red-500 ml-2">•</span><span class="text-red-800 dark:text-red-200">${w}</span></li>`).join('')}
                                </ul>
                            ` : '<p class="text-red-600 dark:text-red-400 italic">لم يتم تحديد نقاط ضعف</p>'}
                        </div>
                    </div>
                    
                    <!-- Recommendations -->
                    <div class="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-4">
                        <h4 class="font-bold text-lg mb-3 text-yellow-900 dark:text-yellow-100">💡 التوصيات</h4>
                        ${eval.recommendations && eval.recommendations.length > 0 ? `
                            <ul class="space-y-2">
                                ${eval.recommendations.map((r, i) => `<li class="flex items-start"><span class="bg-yellow-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm ml-2 flex-shrink-0">${i+1}</span><span class="text-yellow-800 dark:text-yellow-200">${r}</span></li>`).join('')}
                            </ul>
                        ` : '<p class="text-yellow-600 dark:text-yellow-400 italic">لا توجد توصيات</p>'}
                    </div>
                    
                    <!-- Next Steps -->
                    ${eval.nextSteps && eval.nextSteps.length > 0 ? `
                    <div class="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4">
                        <h4 class="font-bold text-lg mb-3 text-purple-900 dark:text-purple-100">📌 الخطوات التالية</h4>
                        <ul class="space-y-2">
                            ${eval.nextSteps.map((s, i) => `<li class="flex items-start"><span class="bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm ml-2 flex-shrink-0">${i+1}</span><span class="text-purple-800 dark:text-purple-200">${s}</span></li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}
                    
                    <!-- Note -->
                    ${eval.note ? `
                    <div class="bg-gray-100 dark:bg-gray-600 rounded-lg p-4 border-r-4 border-gray-500">
                        <p class="text-gray-700 dark:text-gray-200"><strong>ملاحظة:</strong> ${eval.note}</p>
                    </div>
                    ` : ''}
                    
                    <!-- Footer Info -->
                    <div class="text-center text-sm text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-600">
                        <p>🤖 تم التحليل بواسطة: ${eval.aiModel || 'Gemini AI'}</p>
                        <p>🕐 ${eval.timestamp ? new Date(eval.timestamp).toLocaleString('ar-SA') : new Date().toLocaleString('ar-SA')}</p>
                    </div>
                </div>
            `;
        }
    </script>
</x-filament-panels::page>
