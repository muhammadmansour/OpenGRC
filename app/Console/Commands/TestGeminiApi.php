<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class TestGeminiApi extends Command
{
    protected $signature = 'test:gemini-api';
    protected $description = 'Test Gemini API connection';

    public function handle()
    {
        $this->info('Testing Gemini API Connection...');
        $this->newLine();

        $apiUrl = config('services.evaluation_api.url', 'https://muraji-api.wathbahs.com');
        
        // Test 1: Health check
        $this->info('1. Testing health endpoint...');
        try {
            $response = Http::timeout(10)
                ->withOptions(['verify' => false])
                ->get($apiUrl . '/health');
            if ($response->successful()) {
                $this->info('   ✓ Health check passed');
                $this->line('   Response: ' . $response->body());
            } else {
                $this->error('   ✗ Health check failed: ' . $response->status());
            }
        } catch (\Exception $e) {
            $this->error('   ✗ Error: ' . $e->getMessage());
        }
        
        $this->newLine();
        
        // Test 2: Evaluation status
        $this->info('2. Testing evaluation status endpoint...');
        try {
            $response = Http::timeout(10)
                ->withOptions(['verify' => false])
                ->get($apiUrl . '/api/evaluations/status');
            if ($response->successful()) {
                $data = $response->json();
                $this->info('   ✓ Status check passed');
                $this->line('   Available: ' . ($data['available'] ? 'Yes' : 'No'));
                $this->line('   Service: ' . ($data['service'] ?? 'N/A'));
                $this->line('   Model: ' . ($data['model'] ?? 'N/A'));
                $this->line('   Status: ' . ($data['status'] ?? 'N/A'));
            } else {
                $this->error('   ✗ Status check failed: ' . $response->status());
            }
        } catch (\Exception $e) {
            $this->error('   ✗ Error: ' . $e->getMessage());
        }
        
        $this->newLine();
        
        // Test 3: Quick analysis (no Gemini key needed)
        $this->info('3. Testing quick analysis endpoint...');
        try {
            $response = Http::timeout(10)
                ->withOptions(['verify' => false])
                ->post($apiUrl . '/api/evaluations/quick-analysis', [
                    'title' => 'Test Audit Item',
                    'description' => 'This is a test description with enough detail to pass validation checks.',
                    'fileCount' => 2,
                ]);
            
            if ($response->successful()) {
                $data = $response->json();
                $this->info('   ✓ Quick analysis passed');
                $this->line('   Readiness Score: ' . ($data['quickAnalysis']['readinessScore'] ?? 'N/A'));
                $this->line('   Readiness Level: ' . ($data['quickAnalysis']['readinessLevel'] ?? 'N/A'));
            } else {
                $this->error('   ✗ Quick analysis failed: ' . $response->status());
                $this->line('   Response: ' . $response->body());
            }
        } catch (\Exception $e) {
            $this->error('   ✗ Error: ' . $e->getMessage());
        }
        
        $this->newLine();
        $this->info('Test completed!');
        
        return 0;
    }
}
