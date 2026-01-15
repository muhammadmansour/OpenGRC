<div dir="rtl" style="max-width: 900px; margin: 0 auto;">
    @php
        $score = $evaluation['score'] ?? 0;
        $scoreColor = $score >= 80 ? '#10b981' : ($score >= 50 ? '#f59e0b' : '#ef4444');
        $statusText = [
            'Compliant' => 'ممتثل ✓',
            'Partially Compliant' => 'ممتثل جزئياً ◐',
            'Non-Compliant' => 'غير ممتثل ✗'
        ][$evaluation['compliance_status'] ?? ''] ?? ($evaluation['compliance_status'] ?? 'غير محدد');
    @endphp

    {{-- Score Header --}}
    <div style="background: linear-gradient(135deg, {{ $scoreColor }}, {{ $scoreColor }}dd); border-radius: 16px; padding: 24px; color: white; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between;">
        <div style="text-align: center;">
            <div style="font-size: 48px; font-weight: 900;">{{ $score }}/100</div>
            <div style="font-size: 14px; opacity: 0.9;">درجة الامتثال</div>
        </div>
        <div style="text-align: left;">
            <div style="background: rgba(255,255,255,0.2); padding: 8px 20px; border-radius: 20px; font-weight: 600; margin-bottom: 8px;">
                {{ $statusText }}
            </div>
            <div style="font-size: 14px; opacity: 0.8;">{{ $evaluation['effectiveness'] ?? 'N/A' }}</div>
        </div>
    </div>

    {{-- Quick Stats --}}
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
        <div style="background: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">
            <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">📊 الفعالية</div>
            <div style="font-weight: 700; color: #1e293b;">{{ $evaluation['effectiveness'] ?? 'غير محدد' }}</div>
        </div>
        <div style="background: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">
            <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">📋 جودة الأدلة</div>
            <div style="font-weight: 700; color: #1e293b;">{{ $evaluation['evidenceQuality'] ?? 'غير محدد' }}</div>
        </div>
        <div style="background: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">
            <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">⚠️ مستوى المخاطر</div>
            <div style="font-weight: 700; color: #1e293b;">{{ $evaluation['riskAssessment'] ?? 'غير محدد' }}</div>
        </div>
    </div>

    {{-- Summary --}}
    @if(!empty($evaluation['summary']))
    <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
        <h4 style="font-size: 16px; font-weight: 700; color: #1e293b; margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">📄</span> الملخص
        </h4>
        <p style="margin: 0; color: #475569; line-height: 1.8;">{{ $evaluation['summary'] }}</p>
    </div>
    @endif

    {{-- Detailed Analysis --}}
    @if(!empty($evaluation['detailedAnalysis']))
    <div style="background: #eff6ff; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #bfdbfe;">
        <h4 style="font-size: 16px; font-weight: 700; color: #1e40af; margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">🔍</span> التحليل التفصيلي
        </h4>
        <p style="margin: 0; color: #1e40af; line-height: 1.8;">{{ $evaluation['detailedAnalysis'] }}</p>
    </div>
    @endif

    {{-- Files Analyzed --}}
    @if(!empty($evaluation['filesAnalyzed']) && is_array($evaluation['filesAnalyzed']))
    <div style="background: #eef2ff; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #c7d2fe;">
        <h4 style="font-size: 16px; font-weight: 700; color: #3730a3; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">📂</span> الملفات المحللة
        </h4>
        @foreach($evaluation['filesAnalyzed'] as $file)
        <div style="background: white; border-radius: 8px; padding: 12px; margin-bottom: 12px; border: 1px solid #e0e7ff;">
            <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">📄 {{ $file['filename'] ?? 'ملف' }}</div>
            <div style="font-size: 13px; color: #64748b; margin-bottom: 4px;">{{ $file['description'] ?? '' }}</div>
            <span style="display: inline-block; padding: 2px 10px; font-size: 11px; border-radius: 12px; background: #f1f5f9; color: #475569;">
                الصلة: {{ $file['relevance'] ?? 'غير محدد' }}
            </span>
        </div>
        @endforeach
    </div>
    @endif

    {{-- Strengths & Weaknesses --}}
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
        {{-- Strengths --}}
        <div style="background: #ecfdf5; border-radius: 12px; padding: 20px; border: 1px solid #a7f3d0;">
            <h4 style="font-size: 16px; font-weight: 700; color: #065f46; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 18px;">✅</span> نقاط القوة
            </h4>
            @if(!empty($evaluation['strengths']) && is_array($evaluation['strengths']))
                @foreach($evaluation['strengths'] as $strength)
                <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 10px;">
                    <span style="color: #10b981;">●</span>
                    <span style="color: #065f46; font-size: 14px;">{{ $strength }}</span>
                </div>
                @endforeach
            @else
                <p style="color: #94a3b8; font-style: italic; margin: 0;">لم يتم تحديد نقاط قوة</p>
            @endif
        </div>

        {{-- Weaknesses --}}
        <div style="background: #fef2f2; border-radius: 12px; padding: 20px; border: 1px solid #fecaca;">
            <h4 style="font-size: 16px; font-weight: 700; color: #991b1b; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 18px;">⚠️</span> نقاط الضعف
            </h4>
            @if(!empty($evaluation['weaknesses']) && is_array($evaluation['weaknesses']))
                @foreach($evaluation['weaknesses'] as $weakness)
                <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 10px;">
                    <span style="color: #ef4444;">●</span>
                    <span style="color: #991b1b; font-size: 14px;">{{ $weakness }}</span>
                </div>
                @endforeach
            @else
                <p style="color: #94a3b8; font-style: italic; margin: 0;">لم يتم تحديد نقاط ضعف</p>
            @endif
        </div>
    </div>

    {{-- Recommendations --}}
    @if(!empty($evaluation['recommendations']) && is_array($evaluation['recommendations']))
    <div style="background: #fffbeb; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #fde68a;">
        <h4 style="font-size: 16px; font-weight: 700; color: #92400e; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">💡</span> التوصيات
        </h4>
        @foreach($evaluation['recommendations'] as $index => $recommendation)
        <div style="display: flex; align-items: flex-start; gap: 12px; padding: 12px; background: white; border-radius: 8px; margin-bottom: 10px;">
            <span style="width: 24px; height: 24px; background: #f59e0b; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; flex-shrink: 0;">{{ $index + 1 }}</span>
            <span style="color: #92400e; font-size: 14px; line-height: 1.5;">{{ $recommendation }}</span>
        </div>
        @endforeach
    </div>
    @endif

    {{-- Next Steps --}}
    @if(!empty($evaluation['nextSteps']) && is_array($evaluation['nextSteps']))
    <div style="background: #f5f3ff; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #ddd6fe;">
        <h4 style="font-size: 16px; font-weight: 700; color: #5b21b6; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">📌</span> الخطوات التالية
        </h4>
        @foreach($evaluation['nextSteps'] as $index => $step)
        <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 10px;">
            <span style="width: 20px; height: 20px; background: #8b5cf6; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; flex-shrink: 0;">{{ $index + 1 }}</span>
            <span style="color: #5b21b6; font-size: 14px;">{{ $step }}</span>
        </div>
        @endforeach
    </div>
    @endif

    {{-- AI Model Info --}}
    <div style="background: linear-gradient(135deg, #334155, #1e293b); border-radius: 12px; padding: 16px; color: white; display: flex; align-items: center; gap: 16px;">
        <div style="width: 40px; height: 40px; background: #f59e0b; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 20px;">🤖</span>
        </div>
        <div>
            <div style="font-size: 12px; color: #94a3b8;">تم التحليل بواسطة</div>
            <div style="font-weight: bold;">{{ $evaluation['aiModel'] ?? 'Gemini AI' }}</div>
        </div>
        <div style="margin-right: auto; font-size: 12px; color: #64748b;">
            {{ isset($evaluation['timestamp']) ? \Carbon\Carbon::parse($evaluation['timestamp'])->diffForHumans() : 'حديثاً' }}
        </div>
    </div>
</div>
