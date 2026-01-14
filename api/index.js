/**
 * Morage API Server
 * Main entry point for the backend API
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

// Import routes
const authRoutes = require('./routes/auth.routes');
const fileRoutes = require('./routes/file.routes');
const chatRoutes = require('./routes/chat.routes');
const userRoutes = require('./routes/user.routes');
const expertRoutes = require('./routes/expert.routes');
const standardsRoutes = require('./routes/standards.routes');
const submissionRoutes = require('./routes/submission.routes');
const projectRoutes = require('./routes/project.routes');
const domainRoutes = require('./routes/domain.routes');
const adminRoutes = require('./routes/admin.routes');
const extractionRoutes = require('./routes/extraction.routes');
const evaluationRoutes = require('./routes/evaluation.routes');

// Import middleware
const { errorHandler } = require('./middleware/error.middleware');
const { authMiddleware } = require('./middleware/auth.middleware');

const app = express();
const PORT = process.env.PORT || 2020;

// =============================================================================
// MIDDLEWARE
// =============================================================================

// CORS Configuration
const corsOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : [
      'http://localhost:5173', 
      'http://localhost:2020',
      'http://localhost:9700',
      'https://morage.netlify.app',
      'https://muraji.wathbahs.com',
      'https://muraji-separated.wathbahs.com',
      'https://opengrc.wathbahs.com',
      'https://wathbahs.com'
    ];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'userid', 'X-From']
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging (development only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// =============================================================================
// SWAGGER DOCUMENTATION
// =============================================================================

// Swagger UI options
const swaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info .title { color: #1e3a5f }
    .swagger-ui .scheme-container { background: #f8f9fa; padding: 15px }
  `,
  customSiteTitle: 'Morage API Documentation',
  customfavIcon: '/favicon.ico'
};

// Swagger UI endpoint
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// Swagger JSON endpoint
app.get('/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// =============================================================================
// HEALTH CHECK
// =============================================================================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    docs: '/docs'
  });
});

// =============================================================================
// API ROUTES
// =============================================================================

// Public routes (no auth required)
app.use('/api/auth', authRoutes);

// Protected routes (auth required)
app.use('/api/files', authMiddleware, fileRoutes);
app.use('/api/chat', authMiddleware, chatRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/experts', authMiddleware, expertRoutes);
app.use('/api/standards', authMiddleware, standardsRoutes);
app.use('/api/submissions', authMiddleware, submissionRoutes);
app.use('/api/projects', authMiddleware, projectRoutes);
app.use('/api/domains', authMiddleware, domainRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);
app.use('/api/extractions', authMiddleware, extractionRoutes);
app.use('/api/evaluations', authMiddleware, evaluationRoutes);

// =============================================================================
// ERROR HANDLING
// =============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found', 
    message: `Route ${req.method} ${req.path} not found` 
  });
});

// Global error handler
app.use(errorHandler);

// =============================================================================
// SERVER START
// =============================================================================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    MORAGE API SERVER                       ║
╠═══════════════════════════════════════════════════════════╣
║  Status:     RUNNING                                       ║
║  Port:       ${PORT}                                         ║
║  Mode:       ${process.env.NODE_ENV || 'development'}                                ║
║  Time:       ${new Date().toISOString()}             ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
