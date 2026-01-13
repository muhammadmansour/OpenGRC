<?php

namespace App\Filament\Resources\AuditResource\Pages;

use App\Filament\Resources\AuditResource;
use App\Models\User;
use Filament\Actions;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Resources\Pages\EditRecord;

class EditAudit extends EditRecord
{
    protected static string $resource = AuditResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\ViewAction::make(),
            Actions\DeleteAction::make(),
            Actions\ForceDeleteAction::make(),
            Actions\RestoreAction::make(),
        ];
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make(__('audit.edit.section_title'))
                    ->columns(2)
                    ->schema([
                        TextInput::make('title')
                            ->label(__('audit.edit.title'))
                            ->hint(__('audit.edit.title_hint'))
                            ->required()
                            ->columns(1)
                            ->placeholder(__('audit.edit.title_placeholder'))
                            ->columnSpanFull()
                            ->maxLength(255),
                        Select::make('manager_id')
                            ->label(__('audit.edit.audit_manager'))
                            ->hint(__('audit.edit.audit_manager_hint'))
                            ->options(User::query()->pluck('name', 'id')->toArray())
                            ->columns(1)
                            ->searchable(),
                        Select::make('members')
                            ->relationship('members')
                            ->label(__('audit.edit.additional_members'))
                            ->hint(__('audit.edit.additional_members_hint'))
                            ->helperText(__('audit.edit.additional_members_helper'))
                            ->options(User::query()->pluck('name', 'id')->toArray())
                            ->columns(1)
                            ->multiple()
                            ->searchable(),
                        Textarea::make('description')
                            ->label(__('audit.edit.description'))
                            ->columnSpanFull(),
                        DatePicker::make('start_date')
                            ->label(__('audit.edit.start_date'))
                            ->default(now())
                            ->required(),
                        DatePicker::make('end_date')
                            ->label(__('audit.edit.end_date'))
                            ->default(now()->addDays(30))
                            ->required(),
                        AuditResource::taxonomySelect(__('audit.edit.department'), 'department')
                            ->nullable()
                            ->columnSpan(1),
                        AuditResource::taxonomySelect(__('audit.edit.scope'), 'scope')
                            ->nullable()
                            ->columnSpan(1),
                    ]),
            ]);
    }

    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('view', [$this->record]);
    }
}
