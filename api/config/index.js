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
  
  // MySQL Database
  mysql: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    database: process.env.DB_DATABASE || 'opengrc',
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_MAX || '10'),
    queueLimit: 0,
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
