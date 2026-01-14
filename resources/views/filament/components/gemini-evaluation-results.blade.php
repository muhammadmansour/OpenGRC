<div class="space-y-6">
    {{-- Score Banner --}}
    <div class="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div class="flex items-center justify-between">
            <div>
                <h4 class="text-sm font-medium text-gray-500 dark:text-gray-400">Compliance Score</h4>
                <p class="mt-2 text-4xl font-bold text-blue-600 dark:text-blue-400">{{ $evaluation['score'] ?? 'N/A' }}/100</p>
            </div>
            <div class="text-right">
                @php
                    $statusColors = [
                        'high' => 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
                        'medium' => 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
                        'low' => 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
                    ];
                    $complianceLevel = $evaluation['complianceLevel'] ?? 'medium';
                @endphp
                <span class="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium {{ $statusColors[$complianceLevel] ?? $statusColors['medium'] }}">
                    {{ $evaluation['status'] ?? 'N/A' }}
                </span>
                <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ $evaluation['effectiveness'] ?? 'N/A' }}</p>
            </div>
        </div>
    </div>

    {{-- Summary --}}
    @if(!empty($evaluation['summary']))
    <div>
        <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Summary</h4>
        <p class="text-gray-700 dark:text-gray-300">{{ $evaluation['summary'] }}</p>
    </div>
    @endif

    {{-- Detailed Analysis --}}
    @if(!empty($evaluation['detailedAnalysis']))
    <div>
        <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Detailed Analysis</h4>
        <div class="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
            {!! nl2br(e($evaluation['detailedAnalysis'])) !!}
        </div>
    </div>
    @endif

    {{-- Strengths --}}
    @if(!empty($evaluation['strengths']) && is_array($evaluation['strengths']))
    <div>
        <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
            <svg class="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            Strengths
        </h4>
        <ul class="space-y-2">
            @foreach($evaluation['strengths'] as $strength)
            <li class="flex items-start">
                <svg class="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
                <span class="text-gray-700 dark:text-gray-300">{{ $strength }}</span>
            </li>
            @endforeach
        </ul>
    </div>
    @endif

    {{-- Weaknesses --}}
    @if(!empty($evaluation['weaknesses']) && is_array($evaluation['weaknesses']))
    <div>
        <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
            <svg class="w-5 h-5 text-yellow-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            Areas for Improvement
        </h4>
        <ul class="space-y-2">
            @foreach($evaluation['weaknesses'] as $weakness)
            <li class="flex items-start">
                <svg class="w-5 h-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
                <span class="text-gray-700 dark:text-gray-300">{{ $weakness }}</span>
            </li>
            @endforeach
        </ul>
    </div>
    @endif

    {{-- Recommendations --}}
    @if(!empty($evaluation['recommendations']) && is_array($evaluation['recommendations']))
    <div>
        <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
            <svg class="w-5 h-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
            </svg>
            Recommendations
        </h4>
        <ul class="space-y-2">
            @foreach($evaluation['recommendations'] as $recommendation)
            <li class="flex items-start">
                <svg class="w-5 h-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
                <span class="text-gray-700 dark:text-gray-300">{{ $recommendation }}</span>
            </li>
            @endforeach
        </ul>
    </div>
    @endif

    {{-- Next Steps --}}
    @if(!empty($evaluation['nextSteps']) && is_array($evaluation['nextSteps']))
    <div>
        <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Next Steps</h4>
        <ol class="space-y-2 list-decimal list-inside">
            @foreach($evaluation['nextSteps'] as $step)
            <li class="text-gray-700 dark:text-gray-300">{{ $step }}</li>
            @endforeach
        </ol>
    </div>
    @endif

    {{-- Metadata --}}
    <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div class="grid grid-cols-2 gap-4 text-sm">
            @if(!empty($evaluation['evidenceQuality']))
            <div>
                <span class="text-gray-500 dark:text-gray-400">Evidence Quality:</span>
                <span class="ml-2 font-medium text-gray-900 dark:text-gray-100">{{ $evaluation['evidenceQuality'] }}</span>
            </div>
            @endif
            
            @if(!empty($evaluation['riskAssessment']))
            <div>
                <span class="text-gray-500 dark:text-gray-400">Risk Assessment:</span>
                <span class="ml-2 font-medium text-gray-900 dark:text-gray-100">{{ ucfirst($evaluation['riskAssessment']) }}</span>
            </div>
            @endif
            
            @if(!empty($evaluation['evaluatedAt']))
            <div>
                <span class="text-gray-500 dark:text-gray-400">Evaluated:</span>
                <span class="ml-2 font-medium text-gray-900 dark:text-gray-100">{{ \Carbon\Carbon::parse($evaluation['evaluatedAt'])->diffForHumans() }}</span>
            </div>
            @endif
            
            @if(!empty($evaluation['aiModel']))
            <div>
                <span class="text-gray-500 dark:text-gray-400">AI Model:</span>
                <span class="ml-2 font-medium text-gray-900 dark:text-gray-100">{{ $evaluation['aiModel'] }}</span>
            </div>
            @endif
        </div>
    </div>
</div>
