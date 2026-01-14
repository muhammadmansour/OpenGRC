/**
 * Swagger Configuration
 * API Documentation setup
 */

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Morage API',
      version: '1.0.0',
      description: 'مراجي - منصة التدقيق الذكي\n\nMorage AI Audit Platform API Documentation',
      contact: {
        name: 'Wathbahs Team',
        url: 'https://wathbahs.com',
        email: 'support@wathbahs.com'
      },
      license: {
        name: 'Private',
        url: 'https://wathbahs.com'
      }
    },
    servers: [
      {
        url: 'https://muraji-api.wathbahs.com',
        description: 'Production Server'
      },
      {
        url: 'http://localhost:2020',
        description: 'Development Server'
      }
    ],
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'User settings and preferences' },
      { name: 'Experts', description: 'Expert management' },
      { name: 'Projects', description: 'Audit project management' },
      { name: 'Submissions', description: 'Audit submissions' },
      { name: 'Standards', description: 'Audit standards and criteria' },
      { name: 'Domains', description: 'Domain references and templates' },
      { name: 'Files', description: 'File upload and processing' },
      { name: 'Chat', description: 'AI Chat streaming' },
      { name: 'Admin', description: 'Admin operations' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your access token'
        },
        userId: {
          type: 'apiKey',
          in: 'header',
          name: 'userid',
          description: 'User ID header'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Error type' },
            message: { type: 'string', description: 'Error message' }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' }
          }
        },
        Expert: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            expert_id: { type: 'string', example: 'gca-auditor' },
            name_ar: { type: 'string', example: 'مراجع الديوان' },
            name_en: { type: 'string', example: 'GCA Auditor' },
            description: { type: 'string' },
            icon: { type: 'string' },
            domain_id: { type: 'string' },
            is_active: { type: 'boolean' },
            purpose: { type: 'string' },
            system_prompt: { type: 'string' },
            has_yaml: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        Project: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'مشروع تدقيق جديد' },
            description: { type: 'string' },
            expert_type: { type: 'string', example: 'gca-auditor' },
            domain_id: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'in_progress', 'completed', 'cancelled'] },
            user_id: { type: 'string' },
            settings: { type: 'object' },
            selected_standards: { type: 'array', items: { type: 'object' } },
            uploaded_files: { type: 'array', items: { type: 'string' } },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        Submission: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            ministry_id: { type: 'string' },
            ministry_name: { type: 'string' },
            criteria_id: { type: 'string' },
            sub_criteria_id: { type: 'string' },
            file_ids: { type: 'array', items: { type: 'string' } },
            status: { type: 'string', enum: ['submitted', 'processing', 'completed', 'error'] },
            ai_analysis_result: { type: 'object' },
            score: { type: 'number' },
            compliance_level: { type: 'string' },
            submitted_date: { type: 'string', format: 'date-time' },
            last_updated: { type: 'string', format: 'date-time' }
          }
        },
        UserSettings: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            selected_expert_id: { type: 'string' },
            preferences: { type: 'object' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        DomainReference: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            domain_id: { type: 'string' },
            expert_id: { type: 'string' },
            content: { type: 'string' },
            name: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            access_token: { type: 'string' },
            refresh_token: { type: 'string' },
            expires_in: { type: 'integer' },
            token_type: { type: 'string', example: 'Bearer' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' }
              }
            }
          }
        }
      }
    },
    security: [
      { bearerAuth: [], userId: [] }
    ]
  },
  apis: ['./routes/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
