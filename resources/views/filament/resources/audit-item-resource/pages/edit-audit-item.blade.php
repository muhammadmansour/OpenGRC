<x-filament-panels::page>
    {{ $this->form }}

    {{-- AI Evaluation Results Modal - Full Screen Government Style --}}
    <div id="ai-results-modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 9999;">
        {{-- Backdrop --}}
        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8);"></div>
        
        {{-- Full screen container --}}
        <div style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; background: #f8fafc;">
            {{-- Header Bar --}}
            <header style="background: linear-gradient(to left, #1e293b, #334155, #1e293b); border-bottom: 4px solid #f59e0b; padding: 16px 24px; flex-shrink: 0;">
                <div style="max-width: 1400px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <div style="width: 48px; height: 48px; background: #f59e0b; border-radius: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
                            <svg style="width: 28px; height: 28px; color: #1e293b;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                        </div>
                        <div>
                            <h1 style="font-size: 24px; font-weight: bold; color: white; margin: 0;">تقرير التحليل الآلي</h1>
                            <p style="color: #94a3b8; font-size: 14px; margin: 4px 0 0 0;">نظام تقييم الامتثال بالذكاء الاصطناعي</p>
                        </div>
                    </div>
                    <button onclick="closeAiModal()" style="display: flex; align-items: center; gap: 8px; padding: 10px 20px; background: #475569; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500;">
                        <span>إغلاق</span>
                        <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </header>

            {{-- Main Content Area --}}
            <main id="ai-results-content" style="flex: 1; overflow-y: auto; padding: 32px 24px; background: #f8fafc;">
                {{-- Content will be injected by JavaScript --}}
            </main>

            {{-- Footer Bar --}}
            <footer style="background: #1e293b; border-top: 1px solid #334155; padding: 12px 24px; flex-shrink: 0;">
                <div style="max-width: 1400px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; color: #94a3b8; font-size: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <span>تحليل آمن ومشفر</span>
                    </div>
                    <div id="modal-timestamp" style="color: #64748b;"></div>
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
                            // Only include text responses if they're meaningful (more than 50 chars)
                            $textResponse = strip_tags($response->response ?? '');
                            if (!empty($textResponse) && strlen($textResponse) > 50) {
                                $files[] = [
                                    'name' => "Response to {$request->code}.txt",
                                    'mimeType' => 'text/plain',
                                    'description' => "Text response to data request {$request->code}",
                                    'data' => $textResponse,
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
                    
                    // Save evaluation to database via background fetch (no Livewire refresh)
                    console.log('💾 Saving evaluation to database...');
                    fetch('{{ route('filament.app.resources.audit-items.save-evaluation', $record->id) }}', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': '{{ csrf_token() }}',
                        },
                        body: JSON.stringify({ evaluation: evaluation })
                    })
                    .then(res => res.json())
                    .then(result => {
                        if (result.success) {
                            console.log('✅ Evaluation saved to database');
                        } else {
                            console.error('❌ Failed to save:', result.error);
                        }
                    })
                    .catch(error => console.error('❌ Save error:', error));

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
        
        // Function to show saved evaluation in full-screen modal
        window.showSavedEvaluation = function() {
            @php
                $savedEvaluation = $record->ai_evaluation ? json_decode($record->ai_evaluation, true) : null;
            @endphp
            
            const savedEvaluation = @js($savedEvaluation);
            
            if (!savedEvaluation) {
                new FilamentNotification()
                    .title('لا توجد نتائج محفوظة')
                    .warning()
                    .send();
                return;
            }
            
            console.log('📊 Showing saved evaluation:', savedEvaluation);
            showAiResultsModal(savedEvaluation, 0);
        };
        
        console.log('✅ Gemini evaluation script loaded and ready');
        
        // Modal functions
        function showAiResultsModal(evaluation, duration) {
            const modal = document.getElementById('ai-results-modal');
            const content = document.getElementById('ai-results-content');
            
            // Generate styled HTML content
            content.innerHTML = generateEvaluationHTML(evaluation, duration);
            
            // Show modal
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
        
        window.closeAiModal = function() {
            const modal = document.getElementById('ai-results-modal');
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        
        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeAiModal();
        });
        
        function generateEvaluationHTML(eval, duration) {
            const scoreColor = eval.score >= 80 ? '#10b981' : eval.score >= 50 ? '#f59e0b' : '#ef4444';
            const statusText = {
                'Compliant': 'ممتثل ✓',
                'Partially Compliant': 'ممتثل جزئياً ◐',
                'Non-Compliant': 'غير ممتثل ✗'
            }[eval.compliance_status] || eval.compliance_status;

            // Update timestamp in footer
            document.getElementById('modal-timestamp').textContent = new Date().toLocaleString('ar-SA');

            return `
                <div style="max-width: 1400px; margin: 0 auto; direction: rtl;">
                    <!-- Top Section: Score + Stats -->
                    <div style="display: grid; grid-template-columns: 280px 1fr; gap: 24px; margin-bottom: 32px;">
                        <!-- Score Card -->
                        <div style="background: linear-gradient(135deg, ${scoreColor}, ${scoreColor}dd); border-radius: 16px; padding: 32px; color: white; text-align: center; box-shadow: 0 10px 40px ${scoreColor}44;">
                            <div style="width: 140px; height: 140px; margin: 0 auto 16px; background: rgba(255,255,255,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 4px solid rgba(255,255,255,0.3);">
                                <span style="font-size: 56px; font-weight: 900;">${eval.score}</span>
                            </div>
                            <div style="font-size: 18px; opacity: 0.9; margin-bottom: 12px;">من 100 نقطة</div>
                            <div style="background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: 600;">
                                ${statusText}
                            </div>
                            <div style="margin-top: 16px; font-size: 12px; opacity: 0.7;">
                                ${duration > 0 ? `⏱ تم التحليل في ${Math.round(duration/1000)} ثانية` : '📁 نتائج محفوظة مسبقاً'}
                            </div>
                        </div>

                        <!-- Stats Grid -->
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
                            <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
                                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                                    <div style="width: 40px; height: 40px; background: #dbeafe; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                                        <span style="font-size: 18px;">📊</span>
                                    </div>
                                    <span style="font-size: 12px; color: #64748b;">الفعالية</span>
                                </div>
                                <div style="font-size: 16px; font-weight: 700; color: #1e293b;">${eval.effectiveness || 'غير محدد'}</div>
                            </div>
                            <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
                                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                                    <div style="width: 40px; height: 40px; background: #f3e8ff; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                                        <span style="font-size: 18px;">📋</span>
                                    </div>
                                    <span style="font-size: 12px; color: #64748b;">جودة الأدلة</span>
                                </div>
                                <div style="font-size: 16px; font-weight: 700; color: #1e293b;">${eval.evidenceQuality || 'غير محدد'}</div>
                            </div>
                            <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
                                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                                    <div style="width: 40px; height: 40px; background: #fef3c7; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                                        <span style="font-size: 18px;">⚠️</span>
                                    </div>
                                    <span style="font-size: 12px; color: #64748b;">مستوى المخاطر</span>
                                </div>
                                <div style="font-size: 16px; font-weight: 700; color: #1e293b;">${eval.riskAssessment || 'غير محدد'}</div>
                            </div>
                            <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
                                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                                    <div style="width: 40px; height: 40px; background: #ccfbf1; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                                        <span style="font-size: 18px;">📁</span>
                                    </div>
                                    <span style="font-size: 12px; color: #64748b;">الملفات المحللة</span>
                                </div>
                                <div style="font-size: 16px; font-weight: 700; color: #1e293b;">${eval.filesAnalyzed?.length || 0} ملف</div>
                            </div>
                        </div>
                    </div>

                    <!-- Main Content Grid -->
                    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
                        <!-- Left Column -->
                        <div style="display: flex; flex-direction: column; gap: 24px;">
                            <!-- Summary -->
                            <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
                                <div style="background: #f1f5f9; padding: 16px 24px; border-bottom: 1px solid #e2e8f0;">
                                    <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 12px;">
                                        <span style="width: 32px; height: 32px; background: #475569; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white;">📄</span>
                                        الملخص التنفيذي
                                    </h2>
                                </div>
                                <div style="padding: 24px;">
                                    <p style="margin: 0; color: #475569; line-height: 1.8; font-size: 15px;">${eval.summary || 'لا يوجد ملخص متاح'}</p>
                                </div>
                            </div>

                            ${eval.detailedAnalysis ? `
                            <!-- Detailed Analysis -->
                            <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
                                <div style="background: #eff6ff; padding: 16px 24px; border-bottom: 1px solid #bfdbfe;">
                                    <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #1e40af; display: flex; align-items: center; gap: 12px;">
                                        <span style="width: 32px; height: 32px; background: #2563eb; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white;">🔍</span>
                                        التحليل التفصيلي
                                    </h2>
                                </div>
                                <div style="padding: 24px;">
                                    <p style="margin: 0; color: #475569; line-height: 1.8;">${eval.detailedAnalysis}</p>
                                </div>
                            </div>
                            ` : ''}

                            <!-- Strengths & Weaknesses -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                                <!-- Strengths -->
                                <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
                                    <div style="background: #ecfdf5; padding: 16px 24px; border-bottom: 1px solid #a7f3d0;">
                                        <h2 style="margin: 0; font-size: 16px; font-weight: 700; color: #065f46; display: flex; align-items: center; gap: 12px;">
                                            <span style="width: 28px; height: 28px; background: #10b981; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white;">✓</span>
                                            نقاط القوة
                                        </h2>
                                    </div>
                                    <div style="padding: 20px;">
                                        ${eval.strengths && eval.strengths.length > 0 ? 
                                            eval.strengths.map(s => `
                                                <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
                                                    <span style="color: #10b981; font-size: 16px;">●</span>
                                                    <span style="color: #475569; font-size: 14px; line-height: 1.6;">${s}</span>
                                                </div>
                                            `).join('') 
                                            : '<p style="color: #94a3b8; font-style: italic; margin: 0;">لم يتم تحديد نقاط قوة</p>'
                                        }
                                    </div>
                                </div>

                                <!-- Weaknesses -->
                                <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
                                    <div style="background: #fef2f2; padding: 16px 24px; border-bottom: 1px solid #fecaca;">
                                        <h2 style="margin: 0; font-size: 16px; font-weight: 700; color: #991b1b; display: flex; align-items: center; gap: 12px;">
                                            <span style="width: 28px; height: 28px; background: #ef4444; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white;">!</span>
                                            نقاط الضعف
                                        </h2>
                                    </div>
                                    <div style="padding: 20px;">
                                        ${eval.weaknesses && eval.weaknesses.length > 0 ? 
                                            eval.weaknesses.map(w => `
                                                <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
                                                    <span style="color: #ef4444; font-size: 16px;">●</span>
                                                    <span style="color: #475569; font-size: 14px; line-height: 1.6;">${w}</span>
                                                </div>
                                            `).join('') 
                                            : '<p style="color: #94a3b8; font-style: italic; margin: 0;">لم يتم تحديد نقاط ضعف</p>'
                                        }
                                    </div>
                                </div>
                            </div>

                            <!-- Recommendations -->
                            <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
                                <div style="background: #fffbeb; padding: 16px 24px; border-bottom: 1px solid #fde68a;">
                                    <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #92400e; display: flex; align-items: center; gap: 12px;">
                                        <span style="width: 32px; height: 32px; background: #f59e0b; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white;">💡</span>
                                        التوصيات
                                    </h2>
                                </div>
                                <div style="padding: 24px;">
                                    ${eval.recommendations && eval.recommendations.length > 0 ? 
                                        eval.recommendations.map((r, i) => `
                                            <div style="display: flex; align-items: flex-start; gap: 16px; padding: 16px; background: #f8fafc; border-radius: 12px; margin-bottom: 12px;">
                                                <span style="width: 32px; height: 32px; background: #f59e0b; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">${i+1}</span>
                                                <p style="margin: 0; color: #475569; line-height: 1.6; padding-top: 4px;">${r}</p>
                                            </div>
                                        `).join('') 
                                        : '<p style="color: #94a3b8; font-style: italic; margin: 0;">لا توجد توصيات</p>'
                                    }
                                </div>
                            </div>
                        </div>

                        <!-- Right Column - Sidebar -->
                        <div style="display: flex; flex-direction: column; gap: 24px;">
                            ${eval.filesAnalyzed && eval.filesAnalyzed.length > 0 ? `
                            <!-- Files Analyzed -->
                            <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
                                <div style="background: #eef2ff; padding: 16px 24px; border-bottom: 1px solid #c7d2fe;">
                                    <h2 style="margin: 0; font-size: 16px; font-weight: 700; color: #3730a3; display: flex; align-items: center; gap: 12px;">
                                        <span style="width: 28px; height: 28px; background: #6366f1; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white;">📂</span>
                                        الملفات المحللة
                                    </h2>
                                </div>
                                <div style="padding: 16px;">
                                    ${eval.filesAnalyzed.map(f => `
                                        <div style="padding: 16px; background: #f8fafc; border-radius: 12px; margin-bottom: 12px; border: 1px solid #e2e8f0;">
                                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                                                <span style="font-size: 20px;">📄</span>
                                                <span style="font-weight: 600; color: #1e293b; font-size: 14px;">${f.filename}</span>
                                            </div>
                                            <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px; line-height: 1.5;">${f.description}</p>
                                            <span style="display: inline-block; padding: 4px 12px; font-size: 12px; border-radius: 20px; background: ${f.relevance?.includes('High') ? '#dcfce7' : f.relevance?.includes('Low') ? '#f1f5f9' : '#fef3c7'}; color: ${f.relevance?.includes('High') ? '#166534' : f.relevance?.includes('Low') ? '#475569' : '#92400e'};">
                                                الصلة: ${f.relevance}
                                            </span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            ` : ''}

                            ${eval.nextSteps && eval.nextSteps.length > 0 ? `
                            <!-- Next Steps -->
                            <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
                                <div style="background: #f5f3ff; padding: 16px 24px; border-bottom: 1px solid #ddd6fe;">
                                    <h2 style="margin: 0; font-size: 16px; font-weight: 700; color: #5b21b6; display: flex; align-items: center; gap: 12px;">
                                        <span style="width: 28px; height: 28px; background: #8b5cf6; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white;">→</span>
                                        الخطوات التالية
                                    </h2>
                                </div>
                                <div style="padding: 16px;">
                                    ${eval.nextSteps.map((s, i) => `
                                        <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
                                            <span style="width: 24px; height: 24px; background: #8b5cf6; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; flex-shrink: 0;">${i+1}</span>
                                            <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.5;">${s}</p>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            ` : ''}

                            <!-- AI Model Info -->
                            <div style="background: linear-gradient(135deg, #334155, #1e293b); border-radius: 16px; padding: 20px; color: white;">
                                <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
                                    <div style="width: 44px; height: 44px; background: #f59e0b; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                                        <span style="font-size: 24px;">🤖</span>
                                    </div>
                                    <div>
                                        <div style="font-size: 12px; color: #94a3b8;">تم التحليل بواسطة</div>
                                        <div style="font-weight: bold; font-size: 16px;">${eval.aiModel || 'Gemini AI'}</div>
                                    </div>
                                </div>
                                <div style="font-size: 12px; color: #64748b;">
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
