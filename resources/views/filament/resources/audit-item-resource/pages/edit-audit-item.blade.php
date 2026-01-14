<x-filament-panels::page>
    {{ $this->form }}

    @if($geminiEvaluation)
        <div class="mt-4">
            @include('filament.components.gemini-evaluation-results', ['evaluation' => $geminiEvaluation])
        </div>
    @endif

    {{-- Include Gemini Evaluation Script --}}
    @include('filament.components.gemini-evaluation-script', [
        'apiUrl' => config('services.evaluation_api.url', 'https://muraji-api.wathbahs.com'),
        'auditItemId' => $record->id,
        'record' => $record
    ])
</x-filament-panels::page>
