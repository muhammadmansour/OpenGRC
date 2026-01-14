<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // First, permanently delete all soft-deleted users
        DB::table('users')
            ->whereNotNull('deleted_at')
            ->delete();

        // Then remove the deleted_at column
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('deleted_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Add back the deleted_at column if needed
        Schema::table('users', function (Blueprint $table) {
            $table->softDeletes();
        });
    }
};
