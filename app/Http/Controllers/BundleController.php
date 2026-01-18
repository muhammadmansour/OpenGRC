<?php

namespace App\Http\Controllers;

use App\Models\Bundle;
use App\Models\Standard;
use Exception;
use Filament\Notifications\Notification;
use Http;
use Illuminate\Http\Client\RequestException;
use Storage;
use Illuminate\Support\Facades\Log;

class BundleController extends Controller
{
    public static function generate($code): array
    {
        try {
            $standard = Standard::where('code', $code)->with('controls')->firstOrFail();
            $filePath = 'bundlegen/'.$code.'.json';
            Storage::disk('private')->put($filePath, json_encode($standard));

            return ['success' => 'Bundle generated successfully! Saved to storage/app/private/'.$filePath];
        } catch (Exception $e) {
            return ['error' => $e->getMessage()];
        }
    }

    public static function retrieve(): void
    {
        $repo = setting('general.repo', 'https://repo.opengrc.com');

        try {
            $response = Http::withHeaders([
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
                'Pragma' => 'no-cache',
                'Expires' => '0',
            ])->get($repo)->throw();
            $bundles = json_decode($response->body());

            foreach ($bundles as $bundle) {
                Bundle::updateOrCreate(
                    ['code' => $bundle->code],
                    [
                        'code' => $bundle->code,
                        'name' => $bundle->name,
                        'version' => $bundle->version,
                        'authority' => $bundle->authority,
                        'description' => $bundle->description,
                        'repo_url' => $bundle->url,
                        'type' => $bundle->type ?? 'Standard',
                    ]
                );
            }

        } catch (RequestException $e) {
            // Catch exceptions such as 4xx/5xx HTTP status codes or connection issues
            Notification::make()
                ->title('Error Updating Repository')
                ->body($e->getMessage())
                ->color('danger')
                ->send();
        } catch (\Exception $e) {
            // Catch any other potential exceptions
            Notification::make()
                ->title('Error Updating Repository')
                ->body($e->getMessage())
                ->color('danger')
                ->send();
        }

        Notification::make()
            ->title('Repository Updated')
            ->body('Latest Repository content has been retrieved successfully!')
            ->send();
    }

    /**
     * Fetch criteria from Muraji API and save as Standards for audit selection
     * Only imports SUB-CRITERIA (items with parent_code), not parent categories
     */
    public static function retrieveFromMurajiApi(): void
    {
        $apiUrl = setting('general.muraji_api', 'https://muraji-api.wathbahs.com/api/standards/criteria');

        try {
            $response = Http::withHeaders([
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
                'Pragma' => 'no-cache',
                'Expires' => '0',
            ])->get($apiUrl)->throw();
            
            $result = json_decode($response->body(), true);
            
            // Handle both direct array and {data: [...]} format
            $criteria = isset($result['data']) ? $result['data'] : $result;
            
            if (!is_array($criteria)) {
                throw new \Exception('Invalid response format from Muraji API');
            }

            $count = 0;
            $skipped = 0;
            foreach ($criteria as $item) {
                // Skip items without required fields
                if (empty($item['code']) || empty($item['name'])) {
                    continue;
                }

                // ONLY import sub-criteria (items that have a parent)
                // Skip parent categories (items without parent_code or parent_id)
                if (empty($item['parent_code']) && empty($item['parent_id'])) {
                    $skipped++;
                    Log::info("Skipping parent category: {$item['code']} - {$item['name']}");
                    continue;
                }

                // Save sub-criteria to Standards table (for audit selection dropdown)
                Standard::updateOrCreate(
                    ['code' => $item['code']],
                    [
                        'code' => $item['code'],
                        'name' => $item['name'],
                        'authority' => $item['authority'] ?? 'Muraji',
                        'description' => $item['description'] ?? '',
                        'status' => 'In Scope', // Required to appear in audit dropdown
                    ]
                );
                $count++;
            }

            Notification::make()
                ->title('Muraji API Sync Complete')
                ->body("Imported {$count} sub-criteria. Skipped {$skipped} parent categories.")
                ->success()
                ->send();

        } catch (RequestException $e) {
            Log::error('Muraji API fetch failed', ['error' => $e->getMessage()]);
            Notification::make()
                ->title('Error Fetching from Muraji API')
                ->body($e->getMessage())
                ->color('danger')
                ->send();
        } catch (\Exception $e) {
            Log::error('Muraji API error', ['error' => $e->getMessage()]);
            Notification::make()
                ->title('Error Fetching from Muraji API')
                ->body($e->getMessage())
                ->color('danger')
                ->send();
        }
    }

    public static function importBundle(Bundle $bundle): void
    {
        \Log::info('Importing bundle: '.$bundle->code);

        try {
            $response = Http::get($bundle->repo_url)->throw();

            // GitHub raw URLs return application/octet-stream, so we need to force decode
            // Clean invalid UTF-8 sequences that might break JSON parsing
            $body = mb_convert_encoding($response->body(), 'UTF-8', 'UTF-8');
            $bundle_content = json_decode($body, true);

            // Debug: Check if JSON parsing failed
            if ($bundle_content === null) {
                \Log::error('JSON decode failed', [
                    'url' => $bundle->repo_url,
                    'status' => $response->status(),
                    'content_type' => $response->header('Content-Type'),
                    'body_preview' => substr($response->body(), 0, 500),
                ]);
                throw new \Exception('Failed to decode JSON response from: ' . $bundle->repo_url);
            }

            // Validate required fields exist
            if (!isset($bundle_content['code']) || !isset($bundle_content['controls'])) {
                \Log::error('Invalid bundle structure', [
                    'url' => $bundle->repo_url,
                    'keys' => array_keys($bundle_content),
                ]);
                throw new \Exception('Bundle JSON is missing required fields (code or controls)');
            }

            $standard = Standard::updateOrCreate(
                ['code' => $bundle->code],
                [
                    'code' => $bundle_content['code'],
                    'name' => $bundle_content['name'],
                    'authority' => $bundle_content['authority'],
                    'description' => $bundle_content['description'],
                ]
            );



            \Log::info('Importing bundle: '.$bundle->code);

            foreach ($bundle_content['controls'] as $control) {

                $standard->controls()->updateOrCreate(
                    ['code' => $control['code']],
                    [

                        'title' => $control['title'],
                        'code' => $control['code'],
                        'description' => $control['description'],
                        'discussion' => $control['discussion'] ?? null,
                        'test' => $control['test'] ?? null,
                        'type' => $control['type'],
                        'category' => $control['category'],
                        'enforcement' => $control['enforcement'],
                    ]
                );
            }

            $bundle->update(['status' => 'imported']);

        } catch (RequestException $e) {
            // Catch exceptions such as 4xx/5xx HTTP status codes or connection issues
            \Log::error('Bundle download failed', [
                'bundle' => $bundle->code,
                'url' => $bundle->repo_url,
                'error' => $e->getMessage(),
            ]);

            Notification::make()
                ->title('Bundle Import Failed')
                ->body('Download failed: ' . $e->getMessage())
                ->color('danger')
                ->send();
            return;
        } catch (\Exception $e) {
            // Catch any other potential exceptions
            \Log::error('Bundle import error', [
                'bundle' => $bundle->code,
                'url' => $bundle->repo_url,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            Notification::make()
                ->title('Bundle Import Failed')
                ->body('An unexpected error occurred: ' . $e->getMessage())
                ->color('danger')
                ->send();
            return;
        }

        Notification::make()
            ->title('Repository Updated')
            ->body('Latest Repository content has been retrieved successfully!')
            ->send();

    }
}

