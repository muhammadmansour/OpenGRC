<?php

namespace App\Filament\Resources\AuditResource\Pages;

use App\Enums\WorkflowStatus;
use App\Filament\Resources\AuditResource;
use App\Models\Control;
use App\Models\Implementation;
use App\Models\Program;
use App\Models\Standard;
use App\Models\User;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\Grid;
use Filament\Forms\Components\Hidden;
use Filament\Forms\Components\Placeholder;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Wizard\Step;
use Filament\Forms\Get;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Support\HtmlString;
use Filament\Forms\Components\CheckboxList;
use LucasGiovanny\FilamentMultiselectTwoSides\Forms\Components\Fields\MultiselectTwoSides;

class CreateAudit extends CreateRecord
{
    use CreateRecord\Concerns\HasWizard;

    protected static string $resource = AuditResource::class;

    public function getSteps(): array
    {
        return [
            Step::make(__('audit.wizard.steps.audit_type'))
                ->columns(2)
                ->schema([
                    Placeholder::make('Introduction')
                        ->label(__('audit.wizard.audit_type.introduction'))
                        ->columnSpanFull(),
                    Section::make(__('audit.wizard.audit_type.standards.title'))
                        ->columnSpan(1)
                        ->schema(
                            [
                                Placeholder::make('Introduction')
                                    ->label('')
                                    ->content(new HtmlString('                                 
                                        <p>'.__('audit.wizard.audit_type.standards.description').'</p> <p><strong>'.__('audit.wizard.audit_type.standards.note').'</strong></p>                                       
                                ')),
                            ]
                        ),

                    Section::make(__('audit.wizard.audit_type.implementations.title'))
                        ->columnSpan(1)
                        ->schema(
                            [
                                Placeholder::make('Introduction')
                                    ->label('')
                                    ->content(new HtmlString('
                                   <p>'.__('audit.wizard.audit_type.implementations.description').'</p>
                                ')),
                            ]
                        ),

                    Select::make('audit_type')
                        ->label(__('audit.wizard.audit_type.select_type'))
                        ->columns(1)
                        ->required()
                        ->options([
                            'standards' => __('audit.wizard.audit_type.standards.label'),
                            'implementations' => __('audit.wizard.audit_type.implementations.label'),
                            'program' => __('audit.wizard.audit_type.program.label'),
                        ])
                        ->native(false)
                        ->live(),
                    Select::make('sid')
                        ->columns(1)
                        ->label(__('audit.wizard.audit_type.standard_to_audit'))
                        ->options(Standard::where('status', 'In Scope')->pluck('name', 'id'))
                        ->columns(1)
                        ->searchable()
                        ->native(false)
                        ->visible(fn (Get $get) => $get('audit_type') == 'standards'),
                    Select::make('program_id')
                        ->label(__('audit.wizard.audit_type.program_to_audit'))
                        ->relationship('program', 'name')
                        ->searchable()
                        ->preload()
                        ->visible(fn (Get $get) => $get('audit_type') == 'program'),
                ]),

            Step::make(__('audit.wizard.steps.basic_information'))
                ->columns(2)
                ->schema([
                    TextInput::make('title')
                        ->label(__('audit.wizard.basic_info.title'))
                        ->hint(__('audit.wizard.basic_info.title_hint'))
                        ->required()
                        ->columns(1)
                        ->placeholder(__('audit.wizard.basic_info.title_placeholder'))
                        ->maxLength(255),
                    Select::make('manager_id')
                        ->label(__('audit.wizard.basic_info.audit_manager'))
                        ->required()
                        ->hint(__('audit.wizard.basic_info.audit_manager_hint'))
                        ->options(User::query()->pluck('name', 'id')->toArray())
                        ->columns(1)
                        ->default(fn () => auth()->id())
                        ->searchable(),
                    Textarea::make('description')
                        ->label(__('audit.wizard.basic_info.description'))
                        ->maxLength(65535)
                        ->columnSpanFull(),
                    DatePicker::make('start_date')
                        ->label(__('audit.wizard.basic_info.start_date'))
                        ->default(now())
                        ->required(),
                    DatePicker::make('end_date')
                        ->label(__('audit.wizard.basic_info.end_date'))
                        ->default(now()->addDays(30))
                        ->required(),
                    Hidden::make('status')
                        ->default(WorkflowStatus::NOTSTARTED),
                    AuditResource::taxonomySelect(__('audit.wizard.basic_info.department'), 'department')
                        ->nullable()
                        ->columnSpan(1),
                    AuditResource::taxonomySelect(__('audit.wizard.basic_info.scope'), 'scope')
                        ->nullable()
                        ->columnSpan(1),
                ]),

            Step::make(__('audit.wizard.steps.audit_details'))
                ->schema([

                    Grid::make(1)
                        ->schema(
                            function (Get $get): array {
                                $audit_type = $get('audit_type');
                                $standard_id = $get('sid');
                                $implementation_ids = $get('implementation_ids');
                                $allDefaults = [];

                                if ($audit_type == 'standards') {
                                    $controls = Control::where('standard_id', '=', $standard_id)
                                        ->get()
                                        ->mapWithKeys(function ($control) {
                                            return [$control->id => $control->code.' - '.$control->title];
                                        });
                                } elseif ($audit_type == 'implementations') {
                                    $controls = Implementation::query()
                                        ->get()
                                        ->mapWithKeys(function ($implementation) {
                                            return [$implementation->id => $implementation->code.' - '.$implementation->title];
                                        })
                                        ->toArray();
                                } elseif ($audit_type == 'program') {
                                    $program_id = $get('program_id');
                                    if ($program_id) {
                                        $program = Program::find($program_id);
                                        $controls = $program->getAllControls()
                                            ->mapWithKeys(function ($control) {
                                                return [$control->id => $control->code.' - '.$control->title];
                                            });
                                    } else {
                                        $controls = [];
                                    }
                                } else {
                                    $controls = [];
                                }

                                return [
                                    CheckboxList::make('controls')
                                        ->label(__('audit.wizard.details.controls'))
                                        ->options($controls)
                                        ->searchable()
                                        ->bulkToggleable()
                                        ->columns(2)
                                        ->gridDirection('row')
                                        ->default(! is_array($controls) ? array_keys($controls->toArray()) : array_keys($controls))
                                        ->required(),
                                ];
                            }),
                ]),

        ];
    }

    protected function afterCreate(): void
    {
        if (is_array($this->data['controls']) && count($this->data['controls']) > 0) {
            foreach ($this->data['controls'] as $control) {
                $audit_item = $this->record->auditItems()->create([
                    'status' => 'Not Started',
                    'applicability' => 'Applicable',
                    'effectiveness' => 'Not Assessed',
                    'audit_id' => $this->record->id,
                    'user_id' => $this->data['manager_id'],
                ]);

                switch (strtolower($this->data['audit_type'])) {
                    case 'standards':
                        $audit_item->auditable()->associate(Control::find($control));
                        break;
                    case 'implementations':
                        $audit_item->auditable()->associate(Implementation::find($control));
                        break;
                    case 'program':
                        $audit_item->auditable()->associate(Control::find($control));
                        break;
                }
                $audit_item->save();

            }
        }

    }
}
