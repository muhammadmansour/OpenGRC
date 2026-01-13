<?php

return [
    'workflow_status' => [
        'not_started' => 'لم يبدأ',
        'in_progress' => 'قيد التنفيذ',
        'completed' => 'مكتمل',
        'unknown' => 'غير معروف',
    ],
    'effectiveness' => [
        'effective' => 'فعّال',
        'partial' => 'فعّال جزئياً',
        'ineffective' => 'غير فعّال',
        'unknown' => 'غير معروف',
    ],
    'applicability' => [
        'applicable' => 'قابل للتطبيق',
        'not_applicable' => 'غير قابل للتطبيق',
        'partially_applicable' => 'قابل للتطبيق جزئياً',
        'unknown' => 'غير معروف',
    ],
    'control_category' => [
        'preventive' => 'وقائي',
        'detective' => 'كشفي',
        'corrective' => 'تصحيحي',
        'deterrent' => 'رادع',
        'compensating' => 'تعويضي',
        'recovery' => 'استرداد',
        'other' => 'أخرى',
        'unknown' => 'غير معروف',
    ],
    'control_enforcement' => [
        'automated' => 'آلي',
        'manual' => 'يدوي',
        'hybrid' => 'مختلط',
    ],
    'control_type' => [
        'technical' => 'تقني',
        'administrative' => 'إداري',
        'physical' => 'مادي',
        'operational' => 'تشغيلي',
        'other' => 'أخرى',
    ],
    'implementation_status' => [
        'implemented' => 'مُطبّق',
        'not_implemented' => 'غير مُطبّق',
        'in_progress' => 'قيد التنفيذ',
        'planned' => 'مخطط',
    ],
    'response_status' => [
        'pending' => 'معلق',
        'in_progress' => 'قيد التنفيذ',
        'completed' => 'مكتمل',
        'rejected' => 'مرفوض',
    ],
    'risk_level' => [
        'low' => 'منخفض',
        'medium' => 'متوسط',
        'high' => 'عالي',
        'critical' => 'حرج',
    ],
    'risk_status' => [
        'open' => 'مفتوح',
        'mitigated' => 'مخفف',
        'accepted' => 'مقبول',
        'transferred' => 'محوّل',
    ],
    'standard_status' => [
        'draft' => 'مسودة',
        'published' => 'منشور',
        'retired' => 'متقاعد',
        'in_scope' => 'ضمن النطاق',
        'out_of_scope' => 'خارج النطاق',
    ],
    'mitigation_type' => [
        'avoid' => 'تجنب',
        'mitigate' => 'تخفيف',
        'transfer' => 'نقل',
        'accept' => 'قبول',
    ],
    'control_enforcement_category' => [
        'mandatory' => 'إلزامي',
        'addressable' => 'قابل للمعالجة',
        'optional' => 'اختياري',
        'other' => 'أخرى',
    ],
];
