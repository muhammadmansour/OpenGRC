<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ExternalAuthService
{
    protected const API_BASE_URL = 'https://api-gcp.col8.ai';
    protected const DEFAULT_EMAIL = 'ibrahem.amer@wathbahs.com';
    protected const DEFAULT_PASSWORD = '112255@123';

    /**
     * Authenticate against the external API
     */
    public static function authenticate(?string $email = null, ?string $password = null): ?array
    {
        $email = $email ?? self::DEFAULT_EMAIL;
        $password = $password ?? self::DEFAULT_PASSWORD;

        try {
            $response = Http::timeout(60)
                ->withHeaders([
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                ])
                ->post(self::API_BASE_URL . '/auth-kc/signin', [
                    'email' => $email,
                    'password' => $password,
                ]);

            if ($response->successful()) {
                $data = $response->json();
                Log::info('External API authentication successful', ['email' => $email]);
                return $data;
            }

            Log::warning('External API authentication failed', [
                'email' => $email,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return null;
        } catch (\Exception $e) {
            Log::error('External API authentication error', [
                'email' => $email,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Auto-login with default credentials
     */
    public static function autoLogin(): ?array
    {
        return self::authenticate();
    }

    /**
     * Get the token from the authentication response
     */
    public static function getToken(array $authResponse): ?string
    {
        return $authResponse['token'] 
            ?? $authResponse['access_token'] 
            ?? $authResponse['data']['token'] 
            ?? null;
    }
}
