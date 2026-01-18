-- Insert Digital Government Standards Criteria
-- Run this in PostgreSQL

INSERT INTO standard_criteria (code, name, authority, description, version, url, status, created_at, updated_at)
VALUES 
(
    '5.4.1',
    'إعداد الدراسات والبرامج الخاصة بتعزيز الثقافة والبيئة الرقمية',
    'هيئة الحكومة الرقمية',
    'المتطلبات:
• إعداد دراسة لتحديد مستوى وعي منسوبي الجهة بالتحول الرقمي ومدى أهميته، ومدى إطلاع منسوبيها على خطط ومبادرات التحول الرقمي ونسب إنجازها، ومجالات التحول.
• إعداد برامج توعوية لمنسوبي الجهة الحكومية بأهمية عمليات التحول الرقمي بحيث تشمل:
  أ. تحديد الفئات المستهدفة والمستهدفات لزيادة الوعي بالتحول الرقمي من منسوبي الجهة.

2 متطلب • 2 وثيقة مطلوبة',
    '1.0',
    NULL,
    'available',
    NOW(),
    NOW()
),
(
    '5.4.3',
    'استخدام الأدوات التقنية المساعدة في أداء أعمال الجهة',
    'هيئة الحكومة الرقمية',
    '3 متطلب • 2 وثيقة مطلوبة',
    '1.0',
    NULL,
    'available',
    NOW(),
    NOW()
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    authority = EXCLUDED.authority,
    description = EXCLUDED.description,
    version = EXCLUDED.version,
    updated_at = NOW();

-- Verify insertion
SELECT * FROM standard_criteria WHERE code IN ('5.4.1', '5.4.3');
