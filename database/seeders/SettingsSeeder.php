<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

class SettingsSeeder extends Seeder
{
    public function run()
    {

        $settings = [
            [
                'key' => 'general.name',
                'value' => 'WathbaGRC',
            ],
            [
                'key' => 'general.url',
                'value' => 'https://localhost',
            ],
            [
                'key' => 'general.repo',
                'value' => 'https://repo.opengrc.com',
            ],
            [
                'key' => 'mail.host',
                'value' => 'smtp.mailtrap.io',
            ],
            [
                'key' => 'mail.username',
                'value' => 'username',
            ],
            [
                'key' => 'mail.password',
                'value' => 'password',
            ],
            [
                'key' => 'mail.encryption',
                'value' => 'tls',
            ],
            [
                'key' => 'mail.port',
                'value' => '2525',
            ],
            [
                'key' => 'mail.from',
                'value' => 'no-reply@opengrc.com',
            ],
            [
                'key' => 'mail.templates.password_reset_subject',
                'value' => 'WathbaGRC Password Reset',
            ],
            [
                'key' => 'mail.templates.password_reset_body',
                'value' => '<!DOCTYPE html>\n<html>\n<head>\n    <title>Account Created</title>\n</head>\n<body>\n<h1>WathbaGRC Password Reset</h1>\n<p>Hello, {{ $name }}!</p>\n<p>An administrator has performed a password reset on your account. </p>\n<p>Your temporary login details are:</p>\n<ul>\n    <li><strong>URL:</strong> {{ $url }}</li>\n    <li><strong>Email:</strong> {{ $email }}</li>\n    <li><strong>Password:</strong> {{ $password }}</li>\n</ul>\n<p>After logging in you will be prompted to change your password. You will then be asked to re-login with your new secret password before continuing.</p>\n</body>\n</html>',
            ],
            [
                'key' => 'mail.templates.new_account_subject',
                'value' => 'WathbaGRC Account Created',
            ],
            [
                'key' => 'mail.templates.new_account_body',
                'value' => '<!DOCTYPE html>\n<html>\n<head>\n    <title>Account Created</title>\n</head>\n<body>\n<h1>WathbaGRC Account Created</h1>\n<p>Hello, {{ $name }}!</p>\n<p>An WathbaGRC account has been created for you. You may your account using the credentials provided below. </p>\n<p>Your login details are:</p>\n<ul>\n    <li><strong>URL:</strong> {{ $url }}</li>\n    <li><strong>Email:</strong> {{ $email }}</li>\n    <li><strong>Password:</strong> {{ $password }}</li>\n</ul>\n<p>After logging in you will be prompted to change your password. You will then be asked to re-login with your new secret password before continuing.</p>\n</body>\n</html>',
            ],
            [
                'key' => 'mail.templates.evidence_request_subject',
                'value' => 'WathbaGRC Evidence Request',
            ],
            [
                'key' => 'mail.templates.evidence_request_body',
                'value' => '<h1>WathbaGRC Evidence Requested</h1><p>Hello, {{ $name }}!</p><p>An auditor has requested evidence from you. Please login to WathbaGRC to view the request and provide the necessary evidence.</p><p><strong>URL:</strong> {{ $url }}</p><p>Thank you for your cooperation.</p><p><br></p><p><br></p>',
            ],
            [
                'key' => 'mail.templates.survey_invitation_subject',
                'value' => 'Survey Invitation: {{ $surveyTitle }}',
            ],
            [
                'key' => 'mail.templates.survey_invitation_body',
                'value' => '<h1>Survey Invitation</h1><p>Hello, {{ $name }}!</p><p>You have been invited to complete a survey: <strong>{{ $surveyTitle }}</strong></p>@if($description){!! $description !!}@endif<p>Please click the link below to access the survey:</p><p><a href="{{ $surveyUrl }}">{{ $surveyUrl }}</a></p>@if($dueDate)<p><strong>Due Date:</strong> {{ $dueDate }}</p>@endif<p>Thank you for your participation.</p>',
            ],
            [
                'key' => 'security.session_timeout',
                'value' => '15',
            ],
        ];

        foreach ($settings as $setting) {
            $value = stripcslashes($setting['value']);
            //            setting([$setting['key'] => $setting['value']]);

            DB::table('settings')->updateOrInsert(
                ['key' => $setting['key']],
                ['value' => json_encode($value)]
            );
        }

        Artisan::call('cache:clear');

    }
}
