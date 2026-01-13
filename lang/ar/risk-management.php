<?php

return [
    'navigation_label' => 'إدارة المخاطر',
    'heading' => 'إدارة المخاطر',
    
    // Risk levels
    'levels' => [
        'very_low' => 'منخفض جداً',
        'low' => 'منخفض',
        'moderate' => 'متوسط',
        'high' => 'عالي',
        'very_high' => 'عالي جداً',
    ],
    
    // Risk map
    'inherent_risk' => 'المخاطر الكامنة',
    'residual_risk' => 'المخاطر المتبقية',
    'likelihood' => 'الاحتمالية',
    'impact' => 'التأثير',
    'risks' => 'المخاطر',
    
    // Form labels
    'form' => [
        'code' => 'الرمز',
        'name' => 'الاسم',
        'description' => 'الوصف',
        'inherent_risk_scoring' => 'تقييم المخاطر الكامنة',
        'residual_risk_scoring' => 'تقييم المخاطر المتبقية',
        'related_implementations' => 'التطبيقات ذات الصلة',
        'related_implementations_helper' => 'ما الذي نفعله للتخفيف من هذه المخاطر؟',
        'status' => 'الحالة',
        'department' => 'القسم',
        'scope' => 'النطاق',
    ],
    
    // Table
    'table' => [
        'empty_heading' => 'لم يتم تحديد أي مخاطر بعد',
        'empty_description' => 'أضف وحلل أول مخاطرك بالنقر على زر "تتبع مخاطر جديدة" أعلاه.',
        'inherent_risk' => 'المخاطر الكامنة',
        'residual_risk' => 'المخاطر المتبقية',
        'not_assigned' => 'غير مخصص',
    ],
    
    // Actions
    'actions' => [
        'track_new_risk' => 'تتبع مخاطر جديدة',
        'download_risk_report' => 'تحميل تقرير المخاطر',
        'reset_filters' => 'إعادة تعيين الفلاتر',
    ],
    
    // Filters
    'filters' => [
        'inherent_likelihood' => 'الاحتمالية الكامنة',
        'inherent_impact' => 'التأثير الكامن',
        'residual_likelihood' => 'الاحتمالية المتبقية',
        'residual_impact' => 'التأثير المتبقي',
        'department' => 'القسم',
        'scope' => 'النطاق',
    ],
];
