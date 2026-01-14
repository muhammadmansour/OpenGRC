/**
 * Application Configuration
 * Centralized configuration management
 */

const config = {
  // Server
  port: process.env.PORT || 2020,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // External APIs
  authApiUrl: process.env.AUTH_API_URL || 'https://api-gcp.col8.ai',
  llmApiUrl: process.env.LLM_API_URL || 'https://llm-gcp.col8.ai',
  
  // Service Account (for backend-to-backend auth)
  serviceEmail: process.env.AUTH_EMAIL,
  servicePassword: process.env.AUTH_PASSWORD,
  
  // Default Collection
  defaultCollectionId: process.env.DEFAULT_COLLECTION_ID || '118',
  
  // PostgreSQL Database
  postgres: {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    database: process.env.PG_DATABASE || 'morage',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.PG_POOL_MAX || '20'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
  jwtExpiry: process.env.JWT_EXPIRY || '1h',
  refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  
  // Token buffer time (5 minutes before expiry)
  tokenBufferTime: 5 * 60 * 1000,
  
  // File upload limits
  maxFileSizeBytes: 100 * 1024 * 1024, // 100MB
  allowedFileExtensions: ['pdf', 'docx', 'xlsx', 'pptx', 'jpg', 'jpeg', 'png', 'txt', 'dwg', 'dxf'],
  
  // CORS
  corsOrigins: process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
    : [
        'http://localhost:5173', 
        'http://localhost:2020',
        'https://morage.netlify.app',
        'https://muraji.wathbahs.com',
        'https://muraji-separated.wathbahs.com',
        'https://wathbahs.com'
      ]
};

// Validate required configuration
const requiredConfigs = ['serviceEmail', 'servicePassword'];
const missingConfigs = requiredConfigs.filter(key => !config[key]);

if (missingConfigs.length > 0 && config.nodeEnv === 'production') {
  console.error('Missing required configuration:', missingConfigs);
  process.exit(1);
}

module.exports = config;
