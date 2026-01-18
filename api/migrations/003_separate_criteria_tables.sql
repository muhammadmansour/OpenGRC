-- Migration: Separate criteria and sub_criteria into different tables
-- This provides clearer structure and easier queries

-- Drop old table (backup data first if needed!)
-- DROP TABLE IF EXISTS standard_criteria;

-- Table 1: CRITERIA (Parent standards like 5.4)
CREATE TABLE IF NOT EXISTS criteria (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    authority VARCHAR(255),
    description TEXT,
    version VARCHAR(50) DEFAULT '1.0',
    status VARCHAR(50) DEFAULT 'available',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_criteria_code ON criteria(code);
CREATE INDEX IF NOT EXISTS idx_criteria_authority ON criteria(authority);

-- Table 2: SUB_CRITERIA (Children like 5.4.1, 5.4.2, etc.)
CREATE TABLE IF NOT EXISTS sub_criteria (
    id SERIAL PRIMARY KEY,
    criteria_id INTEGER NOT NULL REFERENCES criteria(id) ON DELETE CASCADE,
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    requirements_count INTEGER DEFAULT 0,
    documents_count INTEGER DEFAULT 0,
    version VARCHAR(50) DEFAULT '1.0',
    status VARCHAR(50) DEFAULT 'available',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_criteria_code ON sub_criteria(code);
CREATE INDEX IF NOT EXISTS idx_sub_criteria_criteria_id ON sub_criteria(criteria_id);

-- Example data:
-- INSERT INTO criteria (code, name, authority, description) 
-- VALUES ('5.4', 'الثقافة والبيئة الرقمية', 'هيئة الحكومة الرقمية', '...');
--
-- INSERT INTO sub_criteria (criteria_id, code, name, description, requirements_count, documents_count)
-- VALUES ((SELECT id FROM criteria WHERE code = '5.4'), '5.4.1', 'إعداد الدراسات...', '...', 2, 2);
