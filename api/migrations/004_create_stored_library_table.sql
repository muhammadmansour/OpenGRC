-- =============================================================================
-- Migration 004: Create core_storedlibrary table
-- PostgreSQL Schema for stored libraries
-- =============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the core_storedlibrary table
CREATE TABLE IF NOT EXISTS core_storedlibrary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Identification
    urn VARCHAR(255),
    ref_id VARCHAR(100),
    provider VARCHAR(200),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    annotation TEXT,
    translations JSONB,
    
    -- Localization
    locale VARCHAR(100) NOT NULL DEFAULT 'en',
    default_locale BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Library metadata
    copyright VARCHAR(4096),
    version INTEGER NOT NULL,
    packager VARCHAR(100),
    publication_date DATE,
    builtin BOOLEAN NOT NULL DEFAULT FALSE,
    objects_meta JSONB NOT NULL DEFAULT '{}',
    dependencies JSONB,
    
    -- Storage
    is_loaded BOOLEAN NOT NULL DEFAULT FALSE,
    hash_checksum VARCHAR(64) NOT NULL,
    content JSONB NOT NULL,
    autoload BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Unique constraint for urn + locale + version combination
    CONSTRAINT core_storedlibrary_unique_urn_locale_version 
        UNIQUE (urn, locale, version)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_storedlibrary_urn ON core_storedlibrary(urn);
CREATE INDEX IF NOT EXISTS idx_storedlibrary_hash ON core_storedlibrary(hash_checksum);
CREATE INDEX IF NOT EXISTS idx_storedlibrary_is_loaded ON core_storedlibrary(is_loaded);
CREATE INDEX IF NOT EXISTS idx_storedlibrary_is_published ON core_storedlibrary(is_published);
CREATE INDEX IF NOT EXISTS idx_storedlibrary_provider ON core_storedlibrary(provider);
CREATE INDEX IF NOT EXISTS idx_storedlibrary_locale ON core_storedlibrary(locale);
CREATE INDEX IF NOT EXISTS idx_storedlibrary_name ON core_storedlibrary(name);

-- Add comments for documentation
COMMENT ON TABLE core_storedlibrary IS 'Stores library definitions with content and metadata';
COMMENT ON COLUMN core_storedlibrary.urn IS 'Unique Resource Name for the library';
COMMENT ON COLUMN core_storedlibrary.ref_id IS 'External reference ID';
COMMENT ON COLUMN core_storedlibrary.provider IS 'Library provider/author organization';
COMMENT ON COLUMN core_storedlibrary.content IS 'Full library content as JSON';
COMMENT ON COLUMN core_storedlibrary.hash_checksum IS 'SHA-256 hash of content for integrity verification';
COMMENT ON COLUMN core_storedlibrary.objects_meta IS 'Metadata about objects contained in the library';
COMMENT ON COLUMN core_storedlibrary.dependencies IS 'List of dependent libraries';
COMMENT ON COLUMN core_storedlibrary.is_loaded IS 'Whether the library has been loaded into the system';
COMMENT ON COLUMN core_storedlibrary.is_published IS 'Whether the library is published and visible';
COMMENT ON COLUMN core_storedlibrary.autoload IS 'Whether to automatically load this library on startup';

-- =============================================================================
-- Example Data (commented out)
-- =============================================================================

-- INSERT INTO core_storedlibrary (
--     urn, ref_id, provider, name, description, 
--     locale, version, content, hash_checksum
-- ) VALUES (
--     'urn:library:nca-ecc-2024',
--     'NCA-ECC-1.0',
--     'National Cybersecurity Authority',
--     'NCA Essential Cybersecurity Controls',
--     'Essential Cybersecurity Controls framework by NCA',
--     'en',
--     1,
--     '{"controls": [], "categories": []}',
--     'sha256hashhere'
-- );
