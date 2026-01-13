<?php

return [
    'navigation' => [
        'label' => 'التدقيق',
        'group' => 'الأسس',
    ],
    'breadcrumb' => [
        'title' => 'التدقيق',
    ],
    'model' => [
        'label' => 'تدقيق',
        'plural_label' => 'التدقيق',
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
            'department' => 'القسم',
            'scope' => 'النطاق',
            'not_assigned' => 'غير مخصص',
            'unassigned' => 'غير معين',
        ],
        'filters' => [
            'manager' => 'المدير',
            'status' => 'الحالة',
            'department' => 'القسم',
            'scope' => 'النطاق',
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
    
    // Create Audit Wizard
    'wizard' => [
        'steps' => [
            'audit_type' => 'نوع التدقيق',
            'basic_information' => 'المعلومات الأساسية',
            'audit_details' => 'تفاصيل التدقيق',
        ],
        'audit_type' => [
            'introduction' => 'هناك نوعان من التدقيق للاختيار من بينهما:',
            'select_type' => 'اختر نوع التدقيق',
            'standards' => [
                'title' => 'تدقيق المعايير',
                'description' => 'يستخدم هذا النوع من التدقيق للتحقق من امتثال المنظمة لمعيار محدد. يتم اختيار المعيار من قائمة المعايير المتاحة في النظام. سيتم إجراء التدقيق وفقاً للضوابط المحددة في المعيار المختار.',
                'note' => 'ملاحظة: يجب تعيين المعيار إلى "ضمن النطاق" أولاً.',
                'label' => 'تدقيق المعايير',
            ],
            'implementations' => [
                'title' => 'تدقيق التطبيقات',
                'description' => 'يستخدم هذا النوع من التدقيق لتدقيق تطبيقات الضوابط في منظمتك. يتم اختيار التطبيقات من قائمتك الكاملة للضوابط المُطبّقة وإعدادها للتدقيق.',
                'label' => 'تدقيق التطبيقات',
            ],
            'program' => [
                'label' => 'تدقيق البرنامج',
            ],
            'standard_to_audit' => 'المعيار المراد تدقيقه',
            'program_to_audit' => 'البرنامج المراد تدقيقه',
        ],
        'basic_info' => [
            'title' => 'العنوان',
            'title_hint' => 'أعطِ التدقيق عنواناً مميزاً.',
            'title_placeholder' => 'تدقيق SOC 2 النوع الثاني 2023',
            'audit_manager' => 'مدير التدقيق',
            'audit_manager_hint' => 'من سيدير هذا التدقيق؟',
            'description' => 'الوصف',
            'start_date' => 'تاريخ البدء',
            'end_date' => 'تاريخ الانتهاء',
            'department' => 'القسم',
            'scope' => 'النطاق',
        ],
        'details' => [
            'controls' => 'الضوابط',
            'available_items' => 'العناصر المتاحة',
            'selected_items' => 'العناصر المحددة',
        ],
    ],
];
