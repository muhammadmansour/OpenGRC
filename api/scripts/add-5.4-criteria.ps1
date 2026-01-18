$headers = @{
    "Content-Type" = "application/json; charset=utf-8"
}

# Add criteria 5.4
$criteriaBody = @{
    code = "5.4"
    name = "الثقافة والبيئة الرقمية"
    authority = "هيئة الحكومة الرقمية"
    description = "تعزيز الثقافة الرقمية وخلق بيئة داعمة للتحول الرقمي، يتضمن تطوير برامج لنشر الوعي والثقافة الرقمية، وتوفير بيئة عمل محفزة للتحول الرقمي، وتدريب العاملين على استخدام النظم والموارد المعلوماتية."
    version = "1.0"
} | ConvertTo-Json -Depth 10

Write-Host "Adding criteria 5.4..."
$response1 = Invoke-RestMethod -Uri "https://muraji-api.wathbahs.com/api/standards/criteria" -Method POST -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($criteriaBody))
Write-Host "Response: $($response1 | ConvertTo-Json)"

# Add sub-criteria 5.4.1
$subCriteriaBody = @{
    code = "5.4.1"
    name = "إعداد الدراسات والبرامج الخاصة بتعزيز الثقافة والبيئة الرقمية"
    description = "المتطلبات: إعداد دراسة لتحديد مستوى وعي منسوبي الجهة بالتحول الرقمي ومدى أهميته، ومدى إطلاع منسوبيها على خطط ومبادرات التحول الرقمي ونسب إنجازها، ومجالات التحول. إعداد برامج توعوية لمنسوبي الجهة الحكومية بأهمية عمليات التحول الرقمي."
    requirements_count = 2
    documents_count = 2
    version = "1.0"
} | ConvertTo-Json -Depth 10

Write-Host "Adding sub-criteria 5.4.1 under 5.4..."
$response2 = Invoke-RestMethod -Uri "https://muraji-api.wathbahs.com/api/standards/criteria/5.4/sub" -Method POST -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($subCriteriaBody))
Write-Host "Response: $($response2 | ConvertTo-Json)"

Write-Host "Done!"
