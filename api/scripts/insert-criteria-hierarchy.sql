-- Insert Digital Government Standards with Hierarchy
-- Run migrations/002_add_parent_to_criteria.sql FIRST!

-- Step 1: Insert Parent Criteria (5.4)
INSERT INTO standard_criteria (code, name, authority, description, version, status, created_at, updated_at)
VALUES (
    '5.4',
    'الثقافة والبيئة الرقمية',
    'هيئة الحكومة الرقمية',
    'تعزيز الثقافة الرقمية وخلق بيئة داعمة للتحول الرقمي، يتضمن تطوير برامج لنشر الوعي باستخدام النظم والموارد المعلوماتية.',
    '1.0',
    'available',
    NOW(),
    NOW()
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Step 2: Insert Sub-Criteria (5.4.1) with parent_id
INSERT INTO standard_criteria (code, name, authority, description, version, status, parent_id, created_at, updated_at)
VALUES (
    '5.4.1',
    'إعداد الدراسات والبرامج الخاصة بتعزيز الثقافة والبيئة الرقمية',
    'هيئة الحكومة الرقمية',
    'المتطلبات:
• إعداد دراسة لتحديد مستوى وعي منسوبي الجهة بالتحول الرقمي ومدى أهميته، ومدى إطلاع منسوبيها على خطط ومبادرات التحول الرقمي ونسب إنجازها، ومجالات التحول.
• إعداد برامج توعوية لمنسوبي الجهة الحكومية بأهمية عمليات التحول الرقمي بحيث تشمل:
  أ. تحديد الفئات المستهدفة والمستهدفات لزيادة الوعي بالتحول الرقمي من منسوبي الجهة.

2 متطلب • 2 وثيقة مطلوبة',
    '1.0',
    'available',
    (SELECT id FROM standard_criteria WHERE code = '5.4'),
    NOW(),
    NOW()
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    parent_id = (SELECT id FROM standard_criteria WHERE code = '5.4'),
    updated_at = NOW();

-- Step 3: Insert Sub-Criteria (5.4.3) with parent_id
INSERT INTO standard_criteria (code, name, authority, description, version, status, parent_id, created_at, updated_at)
VALUES (
    '5.4.3',
    'استخدام الأدوات التقنية المساعدة في أداء أعمال الجهة',
    'هيئة الحكومة الرقمية',
    '3 متطلب • 2 وثيقة مطلوبة',
    '1.0',
    'available',
    (SELECT id FROM standard_criteria WHERE code = '5.4'),
    NOW(),
    NOW()
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    parent_id = (SELECT id FROM standard_criteria WHERE code = '5.4'),
    updated_at = NOW();

-- Verify the hierarchy
SELECT 
    c.id,
    c.code,
    c.name,
    c.parent_id,
    p.code as parent_code,
    p.name as parent_name
FROM standard_criteria c
LEFT JOIN standard_criteria p ON c.parent_id = p.id
WHERE c.code LIKE '5.4%'
ORDER BY c.code;
