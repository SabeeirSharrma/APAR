import swaggerJSDoc from 'swagger-jsdoc';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'APAR API',
      version: '0.1.0',
      description: 'AI Powered Applicant Review — API for automating first-pass eligibility review of applicants.',
      contact: {
        name: 'APAR',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token from /auth/login',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
        Applicant: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            company_id: { type: 'string', format: 'uuid' },
            position_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'assigned', 'preparing', 'analyzing', 'verifying', 'encrypting', 'storing', 'delivering', 'completed', 'failed'] },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Interviewer: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            company_id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            public_key: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Position: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            company_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Round: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            position_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            order: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Message: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            application_id: { type: 'string', format: 'uuid' },
            sender_id: { type: 'string', format: 'uuid' },
            sender_type: { type: 'string', enum: ['admin', 'interviewer'] },
            content: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                token: { type: 'string' },
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    name: { type: 'string' },
                    role: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    security: [
      { bearerAuth: [] },
    ],
  },
  apis: [
    `${__dirname}/routes/*.ts`,
    `${__dirname}/routes/*.js`,
    `${__dirname}/../src/routes/*.ts`,
  ],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;