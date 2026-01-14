<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('audit_items', function (Blueprint $table) {
            $table->json('ai_evaluation')->nullable()->after('auditor_notes');
            $table->integer('ai_evaluation_score')->nullable()->after('ai_evaluation');
            $table->timestamp('ai_evaluation_at')->nullable()->after('ai_evaluation_score');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('audit_items', function (Blueprint $table) {
            $table->dropColumn(['ai_evaluation', 'ai_evaluation_score', 'ai_evaluation_at']);
        });
    }
};
