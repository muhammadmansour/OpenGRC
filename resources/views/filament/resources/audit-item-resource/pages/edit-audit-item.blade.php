<x-filament-panels::page>
    {{ $this->form }}

    {{-- AI Evaluation Results Modal - Full Screen Government Style --}}
    <div id="ai-results-modal" class="fixed inset-0 z-50 hidden" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        {{-- Full screen container --}}
        <div class="w-screen h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
            {{-- Header Bar --}}
            <header class="bg-gradient-to-l from-slate-800 via-slate-700 to-slate-800 border-b-4 border-amber-500 px-6 py-4 flex-shrink-0">
                <div class="max-w-7xl mx-auto flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center shadow-lg">
                            <svg class="w-7 h-7 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                        </div>
                        <div>
                            <h1 class="text-2xl font-bold text-white tracking-wide">تقرير التحليل الآلي</h1>
                            <p class="text-slate-300 text-sm">نظام تقييم الامتثال بالذكاء الاصطناعي</p>
                        </div>
                    </div>
                    <button onclick="closeAiModal()" class="flex items-center gap-2 px-5 py-2.5 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl">
                        <span class="font-medium">إغلاق</span>
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </header>

            {{-- Main Content Area --}}
            <main id="ai-results-content" class="flex-1 overflow-y-auto px-6 py-8">
                {{-- Content will be injected by JavaScript --}}
            </main>

            {{-- Footer Bar --}}
            <footer class="bg-slate-800 border-t border-slate-700 px-6 py-3 flex-shrink-0">
                <div class="max-w-7xl mx-auto flex items-center justify-between text-slate-400 text-sm">
                    <div class="flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <span>تحليل آمن ومشفر</span>
                    </div>
                    <div id="modal-timestamp" class="text-slate-500"></div>
                </div>
            </footer>
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
                    
                    // Save evaluation to database via Livewire
                    console.log('💾 Saving evaluation to database...');
                    @this.call('saveGeminiEvaluation', evaluation)
                        .then(() => {
                            console.log('✅ Evaluation saved to database');
                        })
                        .catch((error) => {
                            console.error('❌ Failed to save evaluation:', error);
                        });

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
            const scoreColor = eval.score >= 80 ? 'emerald' : eval.score >= 50 ? 'amber' : 'red';
            const scoreConfig = {
                emerald: { bg: 'from-emerald-600 to-emerald-700', ring: 'ring-emerald-400', text: 'text-emerald-400' },
                amber: { bg: 'from-amber-500 to-amber-600', ring: 'ring-amber-400', text: 'text-amber-400' },
                red: { bg: 'from-red-600 to-red-700', ring: 'ring-red-400', text: 'text-red-400' }
            }[scoreColor];
            
            const statusConfig = {
                'Compliant': { bg: 'bg-emerald-500', text: 'ممتثل', icon: '✓' },
                'Partially Compliant': { bg: 'bg-amber-500', text: 'ممتثل جزئياً', icon: '◐' },
                'Non-Compliant': { bg: 'bg-red-500', text: 'غير ممتثل', icon: '✗' }
            }[eval.compliance_status] || { bg: 'bg-slate-500', text: eval.compliance_status, icon: '?' };

            // Update timestamp in footer
            document.getElementById('modal-timestamp').textContent = new Date().toLocaleString('ar-SA');

            return `
                <div class="max-w-7xl mx-auto" dir="rtl">
                    <!-- Top Stats Grid -->
                    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                        <!-- Main Score Card -->
                        <div class="lg:col-span-1">
                            <div class="bg-gradient-to-br ${scoreConfig.bg} rounded-2xl p-6 text-white shadow-2xl h-full flex flex-col justify-center">
                                <div class="text-center">
                                    <div class="inline-flex items-center justify-center w-32 h-32 rounded-full bg-white/10 backdrop-blur ring-4 ${scoreConfig.ring} mb-4">
                                        <span class="text-5xl font-black">${eval.score}</span>
                                    </div>
                                    <div class="text-lg font-semibold opacity-90">من 100 نقطة</div>
                                    <div class="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full text-sm font-medium">
                                        <span class="text-lg">${statusConfig.icon}</span>
                                        <span>${statusConfig.text}</span>
                                    </div>
                                    <div class="mt-4 text-xs opacity-70 flex items-center justify-center gap-1">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        تم التحليل في ${Math.round(duration/1000)} ثانية
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Quick Stats Cards -->
                        <div class="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div class="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-lg border border-slate-200 dark:border-slate-700">
                                <div class="flex items-center gap-3 mb-3">
                                    <div class="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                                        <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <span class="text-xs font-medium text-slate-500 dark:text-slate-400">الفعالية</span>
                                </div>
                                <div class="text-lg font-bold text-slate-800 dark:text-white">${eval.effectiveness || 'غير محدد'}</div>
                            </div>

                            <div class="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-lg border border-slate-200 dark:border-slate-700">
                                <div class="flex items-center gap-3 mb-3">
                                    <div class="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                                        <svg class="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <span class="text-xs font-medium text-slate-500 dark:text-slate-400">جودة الأدلة</span>
                                </div>
                                <div class="text-lg font-bold text-slate-800 dark:text-white">${eval.evidenceQuality || 'غير محدد'}</div>
                            </div>

                            <div class="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-lg border border-slate-200 dark:border-slate-700">
                                <div class="flex items-center gap-3 mb-3">
                                    <div class="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                                        <svg class="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <span class="text-xs font-medium text-slate-500 dark:text-slate-400">مستوى المخاطر</span>
                                </div>
                                <div class="text-lg font-bold text-slate-800 dark:text-white">${eval.riskAssessment || 'غير محدد'}</div>
                            </div>

                            <div class="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-lg border border-slate-200 dark:border-slate-700">
                                <div class="flex items-center gap-3 mb-3">
                                    <div class="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center">
                                        <svg class="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                    </div>
                                    <span class="text-xs font-medium text-slate-500 dark:text-slate-400">الملفات المحللة</span>
                                </div>
                                <div class="text-lg font-bold text-slate-800 dark:text-white">${eval.filesAnalyzed?.length || 0} ملف</div>
                            </div>
                        </div>
                    </div>

                    <!-- Main Content Grid -->
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <!-- Right Column (2/3) -->
                        <div class="lg:col-span-2 space-y-6">
                            <!-- Summary Section -->
                            <section class="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <div class="bg-slate-100 dark:bg-slate-700 px-6 py-4 border-b border-slate-200 dark:border-slate-600">
                                    <h2 class="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-3">
                                        <div class="w-8 h-8 rounded-lg bg-slate-600 flex items-center justify-center">
                                            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        الملخص التنفيذي
                                    </h2>
                                </div>
                                <div class="p-6">
                                    <p class="text-slate-700 dark:text-slate-300 leading-relaxed text-base">${eval.summary || 'لا يوجد ملخص متاح'}</p>
                                </div>
                            </section>

                            <!-- Detailed Analysis -->
                            ${eval.detailedAnalysis ? `
                            <section class="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <div class="bg-blue-50 dark:bg-blue-900/30 px-6 py-4 border-b border-blue-100 dark:border-blue-800">
                                    <h2 class="text-lg font-bold text-blue-900 dark:text-blue-100 flex items-center gap-3">
                                        <div class="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                                            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        </div>
                                        التحليل التفصيلي
                                    </h2>
                                </div>
                                <div class="p-6">
                                    <p class="text-slate-700 dark:text-slate-300 leading-relaxed">${eval.detailedAnalysis}</p>
                                </div>
                            </section>
                            ` : ''}

                            <!-- Strengths & Weaknesses Grid -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <!-- Strengths -->
                                <section class="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                                    <div class="bg-emerald-50 dark:bg-emerald-900/30 px-6 py-4 border-b border-emerald-100 dark:border-emerald-800">
                                        <h2 class="text-lg font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-3">
                                            <div class="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                                                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                            نقاط القوة
                                        </h2>
                                    </div>
                                    <div class="p-6">
                                        ${eval.strengths && eval.strengths.length > 0 ? `
                                            <ul class="space-y-3">
                                                ${eval.strengths.map(s => `
                                                    <li class="flex items-start gap-3">
                                                        <span class="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                            <svg class="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        </span>
                                                        <span class="text-slate-700 dark:text-slate-300">${s}</span>
                                                    </li>
                                                `).join('')}
                                            </ul>
                                        ` : '<p class="text-slate-500 italic">لم يتم تحديد نقاط قوة</p>'}
                                    </div>
                                </section>

                                <!-- Weaknesses -->
                                <section class="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                                    <div class="bg-red-50 dark:bg-red-900/30 px-6 py-4 border-b border-red-100 dark:border-red-800">
                                        <h2 class="text-lg font-bold text-red-900 dark:text-red-100 flex items-center gap-3">
                                            <div class="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
                                                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                            </div>
                                            نقاط الضعف
                                        </h2>
                                    </div>
                                    <div class="p-6">
                                        ${eval.weaknesses && eval.weaknesses.length > 0 ? `
                                            <ul class="space-y-3">
                                                ${eval.weaknesses.map(w => `
                                                    <li class="flex items-start gap-3">
                                                        <span class="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                            <svg class="w-3 h-3 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </span>
                                                        <span class="text-slate-700 dark:text-slate-300">${w}</span>
                                                    </li>
                                                `).join('')}
                                            </ul>
                                        ` : '<p class="text-slate-500 italic">لم يتم تحديد نقاط ضعف</p>'}
                                    </div>
                                </section>
                            </div>

                            <!-- Recommendations -->
                            <section class="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <div class="bg-amber-50 dark:bg-amber-900/30 px-6 py-4 border-b border-amber-100 dark:border-amber-800">
                                    <h2 class="text-lg font-bold text-amber-900 dark:text-amber-100 flex items-center gap-3">
                                        <div class="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
                                            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                            </svg>
                                        </div>
                                        التوصيات
                                    </h2>
                                </div>
                                <div class="p-6">
                                    ${eval.recommendations && eval.recommendations.length > 0 ? `
                                        <div class="space-y-4">
                                            ${eval.recommendations.map((r, i) => `
                                                <div class="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                                                    <span class="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold flex-shrink-0">${i+1}</span>
                                                    <p class="text-slate-700 dark:text-slate-300 pt-1">${r}</p>
                                                </div>
                                            `).join('')}
                                        </div>
                                    ` : '<p class="text-slate-500 italic">لا توجد توصيات</p>'}
                                </div>
                            </section>
                        </div>

                        <!-- Left Column (1/3) - Sidebar -->
                        <div class="space-y-6">
                            <!-- Files Analyzed -->
                            ${eval.filesAnalyzed && eval.filesAnalyzed.length > 0 ? `
                            <section class="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <div class="bg-indigo-50 dark:bg-indigo-900/30 px-6 py-4 border-b border-indigo-100 dark:border-indigo-800">
                                    <h2 class="text-lg font-bold text-indigo-900 dark:text-indigo-100 flex items-center gap-3">
                                        <div class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                                            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        الملفات المحللة
                                    </h2>
                                </div>
                                <div class="p-4 space-y-3">
                                    ${eval.filesAnalyzed.map(f => `
                                        <div class="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
                                            <div class="flex items-center gap-3 mb-2">
                                                <div class="w-8 h-8 rounded bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                                                    <svg class="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                    </svg>
                                                </div>
                                                <span class="font-medium text-slate-800 dark:text-white text-sm truncate">${f.filename}</span>
                                            </div>
                                            <p class="text-xs text-slate-600 dark:text-slate-400 mb-2">${f.description}</p>
                                            <span class="inline-block px-2 py-1 text-xs rounded-full ${f.relevance?.includes('High') || f.relevance?.includes('عالي') ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : f.relevance?.includes('Low') || f.relevance?.includes('منخفض') ? 'bg-slate-100 text-slate-600 dark:bg-slate-600 dark:text-slate-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'}">
                                                الصلة: ${f.relevance}
                                            </span>
                                        </div>
                                    `).join('')}
                                </div>
                            </section>
                            ` : ''}

                            <!-- Next Steps -->
                            ${eval.nextSteps && eval.nextSteps.length > 0 ? `
                            <section class="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <div class="bg-violet-50 dark:bg-violet-900/30 px-6 py-4 border-b border-violet-100 dark:border-violet-800">
                                    <h2 class="text-lg font-bold text-violet-900 dark:text-violet-100 flex items-center gap-3">
                                        <div class="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
                                            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                            </svg>
                                        </div>
                                        الخطوات التالية
                                    </h2>
                                </div>
                                <div class="p-4">
                                    <div class="space-y-3">
                                        ${eval.nextSteps.map((s, i) => `
                                            <div class="flex items-start gap-3">
                                                <span class="w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">${i+1}</span>
                                                <p class="text-sm text-slate-700 dark:text-slate-300">${s}</p>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            </section>
                            ` : ''}

                            <!-- Note -->
                            ${eval.note ? `
                            <section class="bg-slate-100 dark:bg-slate-700 rounded-2xl p-5 border-r-4 border-slate-500">
                                <div class="flex items-start gap-3">
                                    <svg class="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p class="text-sm text-slate-700 dark:text-slate-300">${eval.note}</p>
                                </div>
                            </section>
                            ` : ''}

                            <!-- AI Model Info -->
                            <div class="bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl p-5 text-white">
                                <div class="flex items-center gap-3 mb-4">
                                    <div class="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
                                        <svg class="w-5 h-5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div class="text-sm text-slate-400">تم التحليل بواسطة</div>
                                        <div class="font-bold">${eval.aiModel || 'Gemini AI'}</div>
                                    </div>
                                </div>
                                <div class="text-xs text-slate-400">
                                    ${eval.timestamp ? new Date(eval.timestamp).toLocaleString('ar-SA') : new Date().toLocaleString('ar-SA')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    </script>
</x-filament-panels::page>
