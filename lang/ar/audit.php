<?php

return [
    'navigation' => [
        'label' => 'التدقيق',
        'group' => 'الأسس',
    ],
    'breadcrumb' => [
        'title' => 'التدقيق',
    ],
    'table' => [
        'empty_state' => [
            'heading' => 'لم يتم إنشاء أي تدقيق',
            'description' => 'جرب إنشاء تدقيق جديد بالنقر على زر "إنشاء تدقيق" أعلاه للبدء!',
        ],
        'columns' => [
            'title' => 'العنوان',
            'audit_type' => 'نوع التدقيق',
            'status' => 'الحالة',
            'manager' => 'المدير',
            'start_date' => 'تاريخ البدء',
            'end_date' => 'تاريخ الانتهاء',
            'created_at' => 'تاريخ الإنشاء',
            'updated_at' => 'تاريخ التحديث',
        ],
    ],
    'infolist' => [
        'section' => [
            'title' => 'تفاصيل التدقيق',
        ],
    ],
    'actions' => [
        'create' => 'إنشاء تدقيق',
    ],
];
