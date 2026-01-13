<?php

namespace App\Filament\Resources\AuditResource\RelationManagers;

use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Facades\Storage;

class AttachmentsRelationManager extends RelationManager
{
    protected static string $relationship = 'attachments';

    protected static ?string $title = 'المرفقات';

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Textarea::make('description')
                    ->label(__('audit.attachments.description'))
                    ->columnSpanFull()
                    ->required(),
                FileUpload::make('file_path')
                    ->downloadable()
                    ->openable()
                    ->columnSpanFull()
                    ->label(__('audit.attachments.file'))
                    ->required()
                    ->disk(setting('storage.driver', config('filesystems.default')))
                    ->visibility('private')
                    ->storeFileNamesIn('file_name')
                    ->getUploadedFileNameForStorageUsing(fn ($file) => $file->getClientOriginalName())
                    ->deleteUploadedFileUsing(function ($state) {
                        if ($state) {
                            Storage::disk(setting('storage.driver', config('filesystems.default')))->delete($state);
                        }
                    }),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->emptyStateHeading(__('audit.attachments.empty_state'))
            ->modifyQueryUsing(function ($query) {
                // Always show "Exported audit evidence ZIP" files first
                return $query->orderByRaw("CASE WHEN description = 'Exported audit evidence ZIP' THEN 0 ELSE 1 END")
                    ->orderBy('updated_at', 'desc');
            })
            ->columns([
                Tables\Columns\TextColumn::make('file_name')
                    ->label(__('audit.attachments.file_name'))
                    ->searchable()
                    ->sortable()
                    ->wrap()
                    ->description(fn ($record) => $record->description),
                Tables\Columns\TextColumn::make('created_at')
                    ->label(__('audit.attachments.uploaded_at'))
                    ->sortable()
                    ->dateTime(),
                Tables\Columns\TextColumn::make('uploaded_by')
                    ->label(__('audit.attachments.uploaded_by'))
                    ->getStateUsing(function ($record) {
                        if ($record->description === 'Exported audit evidence ZIP') {
                            return __('audit.attachments.system');
                        }
                        $user = User::find($record->uploaded_by);

                        return $user ? $user->name : __('audit.attachments.system');
                    }),
            ])
            ->recordClasses(fn ($record) => $record->description === 'Exported audit evidence ZIP' ? 'bg-blue-50' : null)
            ->filters([])
            ->headerActions([
                Tables\Actions\CreateAction::make()
                    ->label(__('audit.attachments.upload'))
                    ->icon('heroicon-o-arrow-up-tray')
                    ->mutateFormDataUsing(function (array $data): array {
                        $data['uploaded_by'] = auth()->id();
                        // created_at/updated_at are auto-set by Eloquent timestamps
                        return $data;
                    }),
                Tables\Actions\ActionGroup::make([
                    Tables\Actions\Action::make('DownloadDraftReport')
                        ->label(__('audit.attachments.download_draft'))
                        ->icon('heroicon-o-document')
                        ->action(function ($record) {
                            $audit = $this->getOwnerRecord();
                            $auditItems = $audit->auditItems;
                            $reportTemplate = 'reports.audit';
                            if ($audit->audit_type == 'implementations') {
                                $reportTemplate = 'reports.implementation-report';
                            }
                            $pdf = Pdf::loadView($reportTemplate, ['audit' => $audit, 'auditItems' => $auditItems]);

                            return response()->streamDownload(
                                fn () => print ($pdf->stream()),
                                "DRAFT-AuditReport-{$audit->id}.pdf"
                            );
                        }),
                    Tables\Actions\Action::make('DownloadFinalReport')
                        ->label(__('audit.attachments.download_final'))
                        ->icon('heroicon-o-document')
                        ->action(function ($record) {
                            $audit = $this->getOwnerRecord();
                            $filepath = "audit_reports/AuditReport-{$audit->id}.pdf";
                            $storage = Storage::disk(config('filesystems.default'));

                            if ($storage->exists($filepath)) {
                                return response()->streamDownload(
                                    fn () => $storage->get($filepath),
                                    "AuditReport-{$audit->id}.pdf"
                                );
                            } else {
                                return Notification::make()
                                    ->title(__('audit.attachments.error'))
                                    ->body(__('audit.attachments.report_not_available'))
                                    ->danger()
                                    ->send();
                            }
                        }),
                ])->label(__('audit.attachments.report_downloads')),
            ])
            ->actions([
                Tables\Actions\Action::make('view')
                    ->label(__('audit.attachments.view'))
                    ->icon('heroicon-o-eye')
                    ->url(function ($record) {
                        $driver = setting('storage.driver', config('filesystems.default'));
                        $disk = Storage::disk($driver);
                        
                        // S3-compatible drivers support temporaryUrl for inline viewing
                        if (in_array($driver, ['s3', 'do'])) {
                            return $disk->temporaryUrl($record->file_path, now()->addMinutes(30));
                        }
                        
                        // For local storage, use the priv-storage route (downloads file)
                        return route('priv-storage', ['filepath' => $record->file_path]);
                    })
                    ->openUrlInNewTab(),
                Tables\Actions\Action::make('download')
                    ->label(__('audit.attachments.download'))
                    ->icon('heroicon-o-arrow-down-tray')
                    ->action(function ($record) {
                        $disk = Storage::disk(setting('storage.driver', config('filesystems.default')));
                        return response()->streamDownload(
                            fn () => print($disk->get($record->file_path)),
                            $record->file_name
                        );
                    }),
                Tables\Actions\DeleteAction::make()
                    ->label(__('audit.attachments.delete')),
            ]);
    }
}
