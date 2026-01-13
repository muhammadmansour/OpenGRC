<?php

namespace App\Filament\Resources;

use App\Enums\RiskStatus;
use App\Filament\Concerns\HasTaxonomyFields;
use App\Filament\Resources\RiskResource\Pages;
use App\Filament\Resources\RiskResource\RelationManagers\ImplementationsRelationManager;
use App\Filament\Resources\RiskResource\RelationManagers\PoliciesRelationManager;
use App\Models\Risk;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Contracts\Support\Htmlable;
use Illuminate\Database\Eloquent\Model;

class RiskResource extends Resource
{
    use HasTaxonomyFields;
    
    protected static ?string $model = Risk::class;

    protected static ?string $navigationIcon = 'heroicon-o-fire';

    protected static ?string $navigationLabel = null;

    public static function getNavigationLabel(): string
    {
        return __('risk-management.navigation_label');
    }

    public static function form(Form $form): Form
    {

        return $form
            ->columns()
            ->schema([
                Forms\Components\TextInput::make('code')
                    ->label(__('risk-management.form.code'))
                    ->unique('risks', 'code', ignoreRecord: true)
                    ->columnSpanFull()
                    ->required(),
                Forms\Components\TextInput::make('name')
                    ->label(__('risk-management.form.name'))
                    ->columnSpanFull()
                    ->required(),
                Forms\Components\Textarea::make('description')
                    ->columnSpanFull()
                    ->label(__('risk-management.form.description')),
                Forms\Components\Section::make('inherent')
                    ->columnSpan(1)
                    ->heading(__('risk-management.form.inherent_risk_scoring'))
                    ->schema([
                        Forms\Components\ToggleButtons::make('inherent_likelihood')
                            ->label(__('risk-management.likelihood'))
                            ->options([
                                '1' => __('risk-management.levels.very_low'),
                                '2' => __('risk-management.levels.low'),
                                '3' => __('risk-management.levels.moderate'),
                                '4' => __('risk-management.levels.high'),
                                '5' => __('risk-management.levels.very_high'),
                            ])
                            ->grouped()
                            ->required(),
                        Forms\Components\ToggleButtons::make('inherent_impact')
                            ->label(__('risk-management.impact'))
                            ->options([
                                '1' => __('risk-management.levels.very_low'),
                                '2' => __('risk-management.levels.low'),
                                '3' => __('risk-management.levels.moderate'),
                                '4' => __('risk-management.levels.high'),
                                '5' => __('risk-management.levels.very_high'),
                            ])
                            ->grouped()
                            ->required(),
                    ]),
                Forms\Components\Section::make('residual')
                    ->columnSpan(1)
                    ->heading(__('risk-management.form.residual_risk_scoring'))
                    ->schema([
                        Forms\Components\ToggleButtons::make('residual_likelihood')
                            ->label(__('risk-management.likelihood'))
                            ->options([
                                '1' => __('risk-management.levels.very_low'),
                                '2' => __('risk-management.levels.low'),
                                '3' => __('risk-management.levels.moderate'),
                                '4' => __('risk-management.levels.high'),
                                '5' => __('risk-management.levels.very_high'),
                            ])
                            ->grouped()
                            ->required(),
                        Forms\Components\ToggleButtons::make('residual_impact')
                            ->label(__('risk-management.impact'))
                            ->options([
                                '1' => __('risk-management.levels.very_low'),
                                '2' => __('risk-management.levels.low'),
                                '3' => __('risk-management.levels.moderate'),
                                '4' => __('risk-management.levels.high'),
                                '5' => __('risk-management.levels.very_high'),
                            ])
                            ->grouped()
                            ->required(),
                    ]),

                Forms\Components\Select::make('implementations')
                    ->label(__('risk-management.form.related_implementations'))
                    ->helperText(__('risk-management.form.related_implementations_helper'))
                    ->relationship(name: 'implementations', titleAttribute: 'title')
                    ->searchable(['title', 'code'])
                    ->multiple(),

                Forms\Components\Select::make('status')
                    ->label(__('risk-management.form.status'))
                    ->enum(RiskStatus::class)
                    ->options(RiskStatus::class)
                    ->required(),
                self::taxonomySelect(__('risk-management.form.department'), 'department')
                    ->nullable()
                    ->columnSpan(1),
                self::taxonomySelect(__('risk-management.form.scope'), 'scope')
                    ->nullable()
                    ->columnSpan(1),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('residual_risk', 'desc')
            ->emptyStateHeading(__('risk-management.table.empty_heading'))
            ->emptyStateDescription(__('risk-management.table.empty_description'))
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->searchable()
                    ->wrap()
                    ->formatStateUsing(function ($state) {
                        // Insert a zero-width space every 30 characters in long words
                        return preg_replace_callback('/\S{30,}/', function ($matches) {
                            return wordwrap($matches[0], 30, "\u{200B}", true);
                        }, $state);
                    })
                    ->limit(100)
                    ->sortable(),
                Tables\Columns\TextColumn::make('description')
                    ->searchable()
                    ->wrap()
                    ->limit(250)
                    ->sortable()
                    ->formatStateUsing(function ($state) {
                        // Insert a zero-width space every 50 characters in long words
                        return preg_replace_callback('/\S{50,}/', function ($matches) {
                            return wordwrap($matches[0], 50, "\u{200B}", true);
                        }, $state);
                    }),
                Tables\Columns\TextColumn::make('inherent_risk')
                    ->label(__('risk-management.table.inherent_risk'))
                    ->sortable()
                    ->color(function (Risk $record) {
                        return self::getRiskColor($record->inherent_likelihood, $record->inherent_impact);
                    })
                    ->badge(),
                Tables\Columns\TextColumn::make('residual_risk')
                    ->sortable()
                    ->badge()
                    ->color(function (Risk $record) {
                        return self::getRiskColor($record->residual_likelihood, $record->residual_impact);
                    }),
                Tables\Columns\TextColumn::make('taxonomy_department')
                    ->label(__('risk-management.form.department'))
                    ->getStateUsing(function (Risk $record) {
                        return self::getTaxonomyTerm($record, 'department')?->name ?? __('risk-management.table.not_assigned');
                    })
                    ->sortable(query: function ($query, string $direction): void {
                        $departmentParent = \Aliziodev\LaravelTaxonomy\Models\Taxonomy::where('slug', 'department')->whereNull('parent_id')->first();
                        if (!$departmentParent) return;

                        $query->leftJoin('taxonomables as dept_taxonomables', function ($join) {
                            $join->on('risks.id', '=', 'dept_taxonomables.taxonomable_id')
                                ->where('dept_taxonomables.taxonomable_type', '=', 'App\\Models\\Risk');
                        })
                        ->leftJoin('taxonomies as dept_taxonomies', function ($join) use ($departmentParent) {
                            $join->on('dept_taxonomables.taxonomy_id', '=', 'dept_taxonomies.id')
                                ->where('dept_taxonomies.parent_id', '=', $departmentParent->id);
                        })
                        ->orderBy('dept_taxonomies.name', $direction)
                        ->select('risks.*');
                    })
                    ->toggleable(),
                Tables\Columns\TextColumn::make('taxonomy_scope')
                    ->label(__('risk-management.form.scope'))
                    ->getStateUsing(function (Risk $record) {
                        return self::getTaxonomyTerm($record, 'scope')?->name ?? __('risk-management.table.not_assigned');
                    })
                    ->sortable(query: function ($query, string $direction): void {
                        $scopeParent = \Aliziodev\LaravelTaxonomy\Models\Taxonomy::where('slug', 'scope')->whereNull('parent_id')->first();
                        if (!$scopeParent) return;

                        $query->leftJoin('taxonomables as scope_taxonomables', function ($join) {
                            $join->on('risks.id', '=', 'scope_taxonomables.taxonomable_id')
                                ->where('scope_taxonomables.taxonomable_type', '=', 'App\\Models\\Risk');
                        })
                        ->leftJoin('taxonomies as scope_taxonomies', function ($join) use ($scopeParent) {
                            $join->on('scope_taxonomables.taxonomy_id', '=', 'scope_taxonomies.id')
                                ->where('scope_taxonomies.parent_id', '=', $scopeParent->id);
                        })
                        ->orderBy('scope_taxonomies.name', $direction)
                        ->select('risks.*');
                    })
                    ->toggleable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('inherent_likelihood')
                    ->label(__('risk-management.filters.inherent_likelihood'))
                    ->options([
                        '1' => __('risk-management.levels.very_low'),
                        '2' => __('risk-management.levels.low'),
                        '3' => __('risk-management.levels.moderate'),
                        '4' => __('risk-management.levels.high'),
                        '5' => __('risk-management.levels.very_high'),
                    ]),
                Tables\Filters\SelectFilter::make('inherent_impact')
                    ->label(__('risk-management.filters.inherent_impact'))
                    ->options([
                        '1' => __('risk-management.levels.very_low'),
                        '2' => __('risk-management.levels.low'),
                        '3' => __('risk-management.levels.moderate'),
                        '4' => __('risk-management.levels.high'),
                        '5' => __('risk-management.levels.very_high'),
                    ]),
                Tables\Filters\SelectFilter::make('residual_likelihood')
                    ->label(__('risk-management.filters.residual_likelihood'))
                    ->options([
                        '1' => __('risk-management.levels.very_low'),
                        '2' => __('risk-management.levels.low'),
                        '3' => __('risk-management.levels.moderate'),
                        '4' => __('risk-management.levels.high'),
                        '5' => __('risk-management.levels.very_high'),
                    ]),
                Tables\Filters\SelectFilter::make('residual_impact')
                    ->label(__('risk-management.filters.residual_impact'))
                    ->options([
                        '1' => __('risk-management.levels.very_low'),
                        '2' => __('risk-management.levels.low'),
                        '3' => __('risk-management.levels.moderate'),
                        '4' => __('risk-management.levels.high'),
                        '5' => __('risk-management.levels.very_high'),
                    ]),
                Tables\Filters\SelectFilter::make('department')
                    ->label(__('risk-management.filters.department'))
                    ->options(function () {
                        $taxonomy = self::getParentTaxonomy('department');

                        if (!$taxonomy) {
                            return [];
                        }

                        return \Aliziodev\LaravelTaxonomy\Models\Taxonomy::where('parent_id', $taxonomy->id)
                            ->orderBy('name')
                            ->pluck('name', 'id')
                            ->toArray();
                    })
                    ->query(function ($query, array $data) {
                        if (!$data['value']) {
                            return;
                        }

                        $query->whereHas('taxonomies', function ($query) use ($data) {
                            $query->where('taxonomy_id', $data['value']);
                        });
                    }),
                Tables\Filters\SelectFilter::make('scope')
                    ->label(__('risk-management.filters.scope'))
                    ->options(function () {
                        $taxonomy = self::getParentTaxonomy('scope');

                        if (!$taxonomy) {
                            return [];
                        }

                        return \Aliziodev\LaravelTaxonomy\Models\Taxonomy::where('parent_id', $taxonomy->id)
                            ->orderBy('name')
                            ->pluck('name', 'id')
                            ->toArray();
                    })
                    ->query(function ($query, array $data) {
                        if (!$data['value']) {
                            return;
                        }

                        $query->whereHas('taxonomies', function ($query) use ($data) {
                            $query->where('taxonomy_id', $data['value']);
                        });
                    }),
            ])
            ->headerActions([
                Tables\Actions\Action::make('reset_filters')
                    ->label(__('risk-management.actions.reset_filters'))
                    ->icon('heroicon-o-arrow-path')
                    ->color('gray')
                    ->alpineClickHandler("\$dispatch('reset-risk-filters')")
                    ->visible(fn ($livewire) => $livewire->hasActiveRiskFilters ?? request()->has('tableFilters')),
            ])
            ->actions([
                Tables\Actions\ViewAction::make()
                    ->slideOver()
                    ->hidden(),
            ])
            ->bulkActions([
                //                Tables\Actions\BulkActionGroup::make([
                //                    Tables\Actions\DeleteBulkAction::make(),
                //                ]),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            'implementations' => ImplementationsRelationManager::class,
            'policies' => PoliciesRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListRisks::route('/'),
            'create' => Pages\CreateRisk::route('/create'),
            // 'edit' => Pages\EditRisk::route('/{record}/edit'),
            'view' => Pages\ViewRisk::route('/{record}'),
        ];
    }

    /**
     * @param  Risk  $record
     */
    public static function getGlobalSearchResultTitle(Model $record): string|Htmlable
    {
        return "$record->name";
    }

    /**
     * @param  Risk  $record
     */
    public static function getGlobalSearchResultUrl(Model $record): string
    {
        return RiskResource::getUrl('view', ['record' => $record]);
    }

    /**
     * @param  Risk  $record
     */
    public static function getGlobalSearchResultDetails(Model $record): array
    {
        return [
            'Risk' => $record->id,
        ];
    }

    public static function getGloballySearchableAttributes(): array
    {
        return ['name', 'description'];
    }

    // Mentioning the following classes to prevent them from being removed.
    // bg-grcblue-200 bg-red-200 bg-orange-200 bg-yellow-200 bg-green-200
    // bg-grcblue-500 bg-red-500 bg-orange-500 bg-yellow-500 bg-green-500

    public static function getRiskColor(int $likelihood, int $impact, int $weight = 200): string
    {
        $average = round(($likelihood + $impact) / 2);

        if ($average >= 5) {
            return "bg-red-$weight"; // High risk
        } elseif ($average >= 4) {
            return "bg-orange-$weight"; // Moderate-High risk
        } elseif ($average >= 3) {
            return "bg-yellow-$weight"; // Moderate risk
        } elseif ($average >= 2) {
            return "bg-grcblue-$weight"; // Moderate risk
        } else {
            return "bg-green-$weight"; // Low risk
        }
    }
}
