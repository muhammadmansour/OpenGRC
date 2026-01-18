-- Migration: Create standard_criteria and imported_standards tables
-- Run this SQL in your PostgreSQL database to set up the tables

-- Table for storing standard criteria (bundles)
CREATE TABLE IF NOT EXISTS standard_criteria (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    authority VARCHAR(255),
    description TEXT,
    version VARCHAR(50),
    url TEXT,
    status VARCHAR(50) DEFAULT 'available',
    imported_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_standard_criteria_code ON standard_criteria(code);
CREATE INDEX IF NOT EXISTS idx_standard_criteria_authority ON standard_criteria(authority);

-- Table for storing imported standard data (full JSON)
CREATE TABLE IF NOT EXISTS imported_standards (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    authority VARCHAR(255),
    description TEXT,
    data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_imported_standards_code ON imported_standards(code);
CREATE INDEX IF NOT EXISTS idx_imported_standards_authority ON imported_standards(authority);

-- Add comment for documentation
COMMENT ON TABLE standard_criteria IS 'Stores available standard criteria/bundles that can be imported';
COMMENT ON TABLE imported_standards IS 'Stores fully imported standard data with controls';
