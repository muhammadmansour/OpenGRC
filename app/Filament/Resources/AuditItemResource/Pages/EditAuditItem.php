<?php

namespace App\Filament\Resources\AuditItemResource\Pages;

use App\Enums\Applicability;
use App\Enums\Effectiveness;
use App\Enums\ResponseStatus;
use App\Enums\WorkflowStatus;
use App\Filament\Resources\AuditItemResource;
use App\Filament\Resources\DataRequestResource;
use App\Http\Controllers\AiController;
use App\Http\Controllers\HelperController;
use App\Mail\EvidenceRequestMail;
use App\Models\AuditItem;
use App\Models\Control;
use App\Models\DataRequest;
use App\Models\User;
use Filament\Actions\Action;
use Filament\Forms;
use Filament\Forms\Components\Placeholder;
use Filament\Forms\Components\RichEditor;
use Filament\Forms\Components\ToggleButtons;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\HtmlString;
use Illuminate\Support\Facades\Http;

class EditAuditItem extends EditRecord
{
    public static ?string $title = 'تقييم عنصر المراجعة';

    // set title to Assess Audit Item
    protected static string $resource = AuditItemResource::class;

    protected static string $view = 'filament.resources.audit-item-resource.pages.edit-audit-item';

    public ?string $aiSuggestion = null;

    public ?array $geminiEvaluation = null;

    public function mount(): void
    {
        parent::mount();
        
        // Load existing AI evaluation if available
        if ($this->record->ai_evaluation) {
            $this->geminiEvaluation = json_decode($this->record->ai_evaluation, true);
        }
    }

    public bool $isEvaluating = false;

    public function getRedirectUrl(): string
    {
        return route('filament.app.resources.audits.view', $this->record->audit_id);
    }

    protected function getHeaderActions(): array
    {
        return [
            Action::make('back')
                ->label('العودة للمراجعة')
                ->icon('heroicon-m-arrow-left')
                ->url(route('filament.app.resources.audits.view', $this->record->audit_id)),
            Action::make('gemini_evaluation')
                ->label('بدأ التحليل')
                ->icon('heroicon-o-sparkles')
                ->color('success')
                ->extraAttributes([
                    'onclick' => 'window.startGeminiEvaluation(); return false;',
                ]),
            Action::make('view_gemini_results')
                ->label('عرض نتائج الذكاء الاصطناعي')
                ->icon('heroicon-o-document-text')
                ->color('info')
                ->hidden(fn () => empty($this->record->ai_evaluation))
                ->modalHeading('نتائج تحليل الذكاء الاصطناعي')
                ->modalContent(function () {
                    $evaluation = json_decode($this->record->ai_evaluation, true);
                    if (!$evaluation) {
                        return view('filament.components.no-evaluation');
                    }
                    
                    return view('filament.components.gemini-evaluation-results', [
                        'evaluation' => $evaluation,
                    ]);
                })
                ->modalSubmitAction(false)
                ->modalCancelActionLabel('إغلاق'),
            Action::make('ai_suggestions')
                ->label(__('Get AI Suggestions'))
                ->icon('heroicon-o-sparkles')
                ->color('warning')
                ->hidden(fn () => setting('ai.enabled') != true)
                ->mountUsing(function () {
                    // For Controls, use the control directly
                    // For Implementations, create a temporary object with the required structure
                    $auditable = $this->record->auditable;
                    if ($auditable instanceof Control) {
                        $this->aiSuggestion = AiController::getControlSuggestions($auditable)->toHtml();
                    } else {
                        // For Implementation, create a compatible structure
                        $record = (object) [
                            'description' => $auditable->details ?? $auditable->title ?? '',
                        ];
                        $this->aiSuggestion = AiController::getControlSuggestions($record)->toHtml();
                    }
                })
                ->modalHeading(__('AI Suggestions'))
                ->modalDescription(fn () => new HtmlString($this->aiSuggestion ?? 'Loading...'))
                ->modalSubmitAction(false)
                ->closeModalByEscaping(true),
            Action::make('ai_check_implementations')
                ->label(__('AI Check Implementations'))
                ->icon('heroicon-o-check-badge')
                ->color('warning')
                // Only show for Controls (Implementations don't have sub-implementations)
                ->hidden(fn () => setting('ai.enabled') != true || ! ($this->record->auditable instanceof Control))
                ->mountUsing(function () {
                    $this->aiSuggestion = AiController::getImplementationCheck($this->record->auditable)->toHtml();
                })
                ->modalHeading(__('AI Implementation Check'))
                ->modalDescription(fn () => new HtmlString($this->aiSuggestion ?? 'Loading...'))
                ->modalSubmitAction(false)
                ->closeModalByEscaping(true),
            Action::make('request_evidence')
                ->label('طلب دليل')
                ->icon('heroicon-m-document')
                ->action(function ($data) {
                    $dataRequest = new DataRequest;
                    $dataRequest->audit_item_id = $this->record->id;
                    $dataRequest->audit_id = $this->record->audit->id;
                    $dataRequest->status = ResponseStatus::PENDING;
                    $dataRequest->created_by_id = auth()->id();
                    $dataRequest->assigned_to_id = $data['user_id'];
                    $dataRequest->details = $data['details'];
                    $dataRequest->code = $data['code'] ?? null;
                    $dataRequest->save();

                    // If code is still null after save, set to Request-{id}
                    if (! $dataRequest->code) {
                        $dataRequest->code = 'Request-'.$dataRequest->id;
                        $dataRequest->save();
                    }

                    if ($data['send_email']) {
                        $user = User::find($dataRequest->assigned_to_id);
                        $data += [
                            'email' => $user->email,
                            'name' => $user->name,
                        ];

                        try {
                            Mail::to($data['email'])->send(new EvidenceRequestMail($data['email'], $data['name']));
                        } catch (\Exception $e) {
                            Notification::make()
                                ->title('فشل إرسال البريد الإلكتروني')
                                ->danger()
                                ->send();
                        }
                    }

                    DataRequestResource::createResponses($dataRequest, $data['due_at']);

                })
                ->after(function () {
                    Notification::make()
                        ->title('تم طلب الدليل')
                        ->body('تم إرسال طلب الدليل بنجاح.')
                        ->success()
                        ->send();
                })
                ->form([
                    Forms\Components\Group::make()
                        ->columns(2)
                        ->schema([
                            Forms\Components\Select::make('user_id')
                                ->label('المكلف')
                                ->options(User::pluck('name', 'id'))
                                ->default($this->record->audit->manager_id)
                                ->required()
                                ->searchable(),
                            Forms\Components\DatePicker::make('due_at')
                                ->label('تاريخ الاستحقاق')
                                ->default(HelperController::getEndDate($this->record->audit->end_date, 5))
                                ->required(),
                            Forms\Components\Textarea::make('details')
                                ->label('تفاصيل الطلب')
                                ->maxLength(65535)
                                ->columnSpanFull()
                                ->required(),
                            Forms\Components\TextInput::make('code')
                                ->label('رمز الطلب')
                                ->maxLength(255)
                                ->helperText('اختياري. إذا تُرك فارغاً، سيتم تعيين Request-{id} تلقائياً.')
                                ->nullable(),
                            Forms\Components\Checkbox::make('send_email')
                                ->label('إرسال إشعار بالبريد الإلكتروني')
                                ->default(true),
                        ]),
                ])
                ->modalHeading('طلب دليل')
                ->modalSubmitActionLabel('إرسال')
                ->modalCancelActionLabel('إلغاء'),
        ];
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('معلومات العنصر')
                    ->schema([
                        Placeholder::make('control_code')
                            ->label('الرمز')
                            ->content(fn (AuditItem $record): ?string => $record->auditable->code),
                        Placeholder::make('control_title')
                            ->label('العنوان')
                            ->content(fn (AuditItem $record): ?string => $record->auditable->title),
                        Placeholder::make('control_desc')
                            ->label('الوصف')
                            ->content(fn (AuditItem $record): HtmlString => new HtmlString(optional($record->auditable)->description ?? ''))
                            ->columnSpanFull(),
                        Placeholder::make('control_discussion')
                            ->label('المناقشة')
                            ->content(fn (AuditItem $record): HtmlString => new HtmlString(optional($record->auditable)->discussion ?? ''))
                            ->columnSpanFull(),

                    ])->columns(2)->collapsible(true),

                Forms\Components\Section::make('التقييم')
                    ->schema([
                        ToggleButtons::make('status')
                            ->label('الحالة')
                            ->options(WorkflowStatus::class)
                            ->default('Not Started')
                            ->grouped(),
                        ToggleButtons::make('effectiveness')
                            ->label('الفعالية')
                            ->options(Effectiveness::class)
                            ->default('Not Effective')
                            ->grouped(),
                        ToggleButtons::make('applicability')
                            ->label('القابلية للتطبيق')
                            ->options(Applicability::class)
                            ->default('Applicable')
                            ->grouped(),
                        RichEditor::make('auditor_notes')
                            ->columnSpanFull()
                            ->maxLength(65535)
                            ->disableToolbarButtons([
                                'image',
                                'attachFiles',
                            ])
                            ->label('ملاحظات المدقق'),
                    ]),

                Forms\Components\Section::make('أدلة المراجعة')
                    ->schema([
                        // Todo: This can be replaced with a Repeater component when nested relationships are
                        // supported in Filament - potentially in v4.x. Or, maybe do a footer widget.
                        Placeholder::make('control.implementations')
                            ->hidden($this->record->audit->audit_type == 'implementations')
                            ->label('التطبيقات الموثقة')
                            ->view('tables.implementations-table', ['implementations' => $this->record->auditable->implementations])
                            ->columnSpanFull()
                            ->hintIcon('heroicon-m-question-mark-circle', tooltip: 'التطبيقات المرتبطة بهذا الضابط.'),
                        Placeholder::make('data_requests')
                            ->label('طلبات البيانات')
                            ->view('tables.data-requests-table', ['requests' => $this->record->dataRequests])
                            ->columnSpanFull()
                            ->hintIcon('heroicon-m-question-mark-circle', tooltip: 'طلبات البيانات التي تم إصدارها.'),
                    ])
                    ->collapsible(true),
            ]);
    }


    public function saveGeminiEvaluation(array $evaluation): void
    {
        try {
            $this->record->update([
                'ai_evaluation' => json_encode($evaluation),
                'ai_evaluation_score' => $evaluation['score'] ?? null,
                'ai_evaluation_at' => now(),
            ]);

            $this->geminiEvaluation = $evaluation;

            \Log::info('✅ Gemini evaluation saved', [
                'audit_item_id' => $this->record->id,
                'score' => $evaluation['score'] ?? null,
            ]);

            $this->dispatch('evaluationSaved');
        } catch (\Exception $e) {
            \Log::error('❌ Failed to save evaluation', [
                'error' => $e->getMessage(),
            ]);
        }
    }
}
