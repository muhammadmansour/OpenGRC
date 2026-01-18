CREATE TABLE IF NOT EXISTS standard_criteria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    authority VARCHAR(255),
    description TEXT,
    version VARCHAR(50),
    url TEXT,
    status VARCHAR(50) DEFAULT 'available',
    imported_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_standard_criteria_code (code),
    INDEX idx_standard_criteria_authority (authority)
);

CREATE TABLE IF NOT EXISTS imported_standards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    authority VARCHAR(255),
    description TEXT,
    data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_imported_standards_code (code),
    INDEX idx_imported_standards_authority (authority)
);
