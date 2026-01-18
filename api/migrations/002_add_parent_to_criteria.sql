-- Migration: Add parent_id to support hierarchical criteria structure
-- Run this in PostgreSQL

-- Add parent_id column to support hierarchy
ALTER TABLE standard_criteria 
ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES standard_criteria(id) ON DELETE CASCADE;

-- Add index for faster parent lookups
CREATE INDEX IF NOT EXISTS idx_standard_criteria_parent ON standard_criteria(parent_id);

-- Example: Insert parent criteria first, then sub-criteria
-- 
-- Step 1: Insert Parent (5.4)
-- INSERT INTO standard_criteria (code, name, authority, description, version) 
-- VALUES ('5.4', 'الثقافة والبيئة الرقمية', 'هيئة الحكومة الرقمية', 'تعزيز الثقافة الرقمية...', '1.0');
--
-- Step 2: Insert Sub-criteria with parent_id
-- INSERT INTO standard_criteria (code, name, authority, description, version, parent_id) 
-- VALUES ('5.4.1', 'إعداد الدراسات والبرامج...', 'هيئة الحكومة الرقمية', '...', '1.0', 
--         (SELECT id FROM standard_criteria WHERE code = '5.4'));
