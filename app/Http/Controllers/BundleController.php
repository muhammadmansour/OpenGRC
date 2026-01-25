<?php

namespace App\Http\Controllers;

use App\Models\Bundle;
use App\Models\Control;
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
     * Fetch libraries from Muraji API in OpenGRC format and add to Bundles page
     * Users can then click "Import Bundle" to import them as Standards + Controls
     */
    public static function retrieveFromMurajiApi(): void
    {
        // Use the new OpenGRC format endpoint
        $apiUrl = setting('general.muraji_api', 'https://muraji-api.wathbahs.com/api/libraries?format=opengrc&output=full');

        try {
            $response = Http::withHeaders([
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
                'Pragma' => 'no-cache',
                'Expires' => '0',
            ])->timeout(60)->get($apiUrl)->throw();
            
            $result = json_decode($response->body(), true);
            
            // Handle {success, data: [...]} format
            if (!isset($result['success']) || !$result['success']) {
                throw new \Exception('Muraji API returned unsuccessful response');
            }
            
            $libraries = $result['data'] ?? [];
            
            if (!is_array($libraries)) {
                throw new \Exception('Invalid response format from Muraji API');
            }

            $count = 0;

            // Add each library to Bundles table (for display in Bundles page)
            foreach ($libraries as $library) {
                $bundle = $library['bundle'] ?? null;
                $standard = $library['standard'] ?? null;
                $metadata = $library['metadata'] ?? [];
                
                if (empty($bundle['code']) || empty($bundle['name'])) {
                    continue;
                }

                // Count controls
                $controlsCount = count($standard['controls'] ?? []);

                // Add to Bundles table
                Bundle::updateOrCreate(
                    ['code' => $bundle['code']],
                    [
                        'code' => $bundle['code'],
                        'name' => $bundle['name'],
                        'version' => $bundle['version'] ?? '1.0',
                        'authority' => $bundle['authority'] ?? 'Muraji',
                        'description' => ($bundle['description'] ?? '') . "\n\n" . $controlsCount . ' controls',
                        'source_url' => $bundle['source_url'] ?? null,
                        'repo_url' => $bundle['repo_url'] ?? ('muraji-library://' . ($metadata['library_id'] ?? $bundle['code'])),
                        'type' => $bundle['type'] ?? 'Standard',
                    ]
                );
                $count++;
                Log::info("Added to Bundles: {$bundle['code']} - {$bundle['name']} ({$controlsCount} controls)");
            }

            Notification::make()
                ->title('Muraji API Sync Complete')
                ->body("Added {$count} frameworks to Bundles. Click 'Import Bundle' to import them.")
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

    /**
     * Import a Muraji library bundle using OpenGRC format
     * Fetches from /api/libraries/:id?format=opengrc&output=full
     */
    public static function importMurajiBundle(Bundle $bundle): void
    {
        // Extract library ID from repo_url (format: muraji-library://UUID)
        $libraryId = null;
        if (preg_match('/muraji-library:\/\/(.+)/', $bundle->repo_url, $matches)) {
            $libraryId = $matches[1];
        }
        
        if (!$libraryId) {
            // Fallback: try to find by fetching all libraries and matching by code
            Log::warning("No library ID in repo_url, attempting to find by code: {$bundle->code}");
            $libraryId = self::findLibraryIdByCode($bundle->code);
        }
        
        if (!$libraryId) {
            Notification::make()
                ->title('Import Failed')
                ->body("Could not determine library ID for bundle: {$bundle->code}")
                ->color('danger')
                ->send();
            return;
        }

        $apiUrl = "https://muraji-api.wathbahs.com/api/libraries/{$libraryId}?format=opengrc&output=full";

        try {
            // Fetch the library in OpenGRC format
            $response = Http::timeout(60)->get($apiUrl)->throw();
            $result = json_decode($response->body(), true);
            
            if (!isset($result['success']) || !$result['success']) {
                throw new \Exception('Muraji API returned unsuccessful response');
            }
            
            $data = $result['data'] ?? $result;
            $bundleData = $data['bundle'] ?? null;
            $standardData = $data['standard'] ?? null;
            
            if (empty($standardData['code'])) {
                throw new \Exception('Invalid library data from Muraji API');
            }

            // Create Standard from the converted data
            $standard = Standard::updateOrCreate(
                ['code' => $standardData['code']],
                [
                    'code' => $standardData['code'],
                    'name' => $standardData['name'],
                    'authority' => $standardData['authority'] ?? 'Muraji',
                    'description' => $standardData['description'] ?? '',
                    'status' => 'In Scope',
                ]
            );
            Log::info("Created Standard: {$standardData['code']}");

            // Import controls directly from the converted data
            $controls = $standardData['controls'] ?? [];
            $controlsCount = 0;
            
            foreach ($controls as $control) {
                if (empty($control['code'])) {
                    continue;
                }

                Control::updateOrCreate(
                    ['code' => $control['code'], 'standard_id' => $standard->id],
                    [
                        'standard_id' => $standard->id,
                        'code' => $control['code'],
                        'title' => $control['title'] ?? $control['code'],
                        'description' => $control['description'] ?? '',
                        'discussion' => $control['discussion'] ?? null,
                        'test' => $control['test'] ?? null,
                        'type' => $control['type'] ?? 'Other',
                        'category' => $control['category'] ?? 'Other',
                        'enforcement' => $control['enforcement'] ?? 'Mandatory',
                    ]
                );
                $controlsCount++;
            }

            // Mark bundle as imported
            $bundle->update(['status' => 'imported']);

            Notification::make()
                ->title('Muraji Bundle Imported')
                ->body("Created standard {$standardData['code']} with {$controlsCount} controls.")
                ->success()
                ->send();

        } catch (\Exception $e) {
            Log::error('Muraji bundle import failed', ['error' => $e->getMessage(), 'url' => $apiUrl]);
            Notification::make()
                ->title('Import Failed')
                ->body($e->getMessage())
                ->color('danger')
                ->send();
        }
    }
    
    /**
     * Helper: Find library ID by bundle code
     */
    private static function findLibraryIdByCode(string $code): ?string
    {
        try {
            $response = Http::timeout(30)->get('https://muraji-api.wathbahs.com/api/libraries?format=opengrc&output=bundle')->throw();
            $result = json_decode($response->body(), true);
            
            foreach ($result['data'] ?? [] as $library) {
                if (($library['code'] ?? '') === $code) {
                    // Extract ID from source_url
                    if (preg_match('/\/libraries\/([a-f0-9-]+)/', $library['source_url'] ?? '', $matches)) {
                        return $matches[1];
                    }
                }
            }
        } catch (\Exception $e) {
            Log::error('Failed to find library by code', ['code' => $code, 'error' => $e->getMessage()]);
        }
        
        return null;
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

