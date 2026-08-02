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
    tags: [
      { name: 'Auth', description: 'Authentication & registration' },
      { name: 'Upload', description: 'Resume upload' },
      { name: 'Applicants', description: 'Applicant management' },
      { name: 'Interviewers', description: 'Interviewer management' },
      { name: 'Positions', description: 'Position management' },
      { name: 'Rounds', description: 'Interview round management' },
      { name: 'Tags', description: 'Tag management' },
      { name: 'Notes', description: 'Applicant notes' },
      { name: 'Messages', description: 'Applicant messages' },
      { name: 'Setup', description: 'Initial setup wizard' },
      { name: 'Features', description: 'Feature flags' },
      { name: 'Custom UI', description: 'Custom UI / widget management' },
      { name: 'Status', description: 'Public application status' },
      { name: 'Health', description: 'Health check' },
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
            status: { type: 'string', enum: ['pending', 'assigned', 'preparing', 'analyzing', 'verifying', 'encrypting', 'storing', 'delivering', 'completed', 'failed', 'approved', 'rejected'] },
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
            criteria: { type: 'string' },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Round: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            position_id: { type: 'string', format: 'uuid' },
            round_number: { type: 'integer' },
            name: { type: 'string' },
            description: { type: 'string' },
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
        Tag: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            color: { type: 'string' },
            scope: { type: 'string', enum: ['global', 'local'] },
            is_approved: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Note: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            interviewer_id: { type: 'string', format: 'uuid' },
            interviewer_name: { type: 'string' },
            content: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        FeatureFlag: {
          type: 'object',
          properties: {
            feature: { type: 'string' },
            isEnabled: { type: 'boolean' },
          },
        },
        CustomUI: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            platform: { type: 'string' },
            name: { type: 'string' },
            version: { type: 'string' },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        SetupStatus: {
          type: 'object',
          properties: {
            isComplete: { type: 'boolean' },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  completed: { type: 'boolean' },
                },
              },
            },
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
    paths: {
      '/api/v1/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Register a new company',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'adminEmail', 'adminName', 'password', 'submissionEmail'],
                  properties: {
                    name: { type: 'string', description: 'Company name' },
                    adminEmail: { type: 'string', format: 'email' },
                    adminName: { type: 'string' },
                    password: { type: 'string', format: 'password' },
                    submissionEmail: { type: 'string', format: 'email', description: 'Email for receiving submissions' },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Company registered successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      companyId: { type: 'string', format: 'uuid' },
                      adminId: { type: 'string', format: 'uuid' },
                      name: { type: 'string' },
                      adminEmail: { type: 'string', format: 'email' },
                      token: { type: 'string' },
                      expiresAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
          },
          security: [],
        },
      },
      '/api/v1/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Logged in',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      userId: { type: 'string', format: 'uuid' },
                      companyId: { type: 'string', format: 'uuid' },
                      role: { type: 'string', enum: ['admin', 'interviewer'] },
                      name: { type: 'string' },
                      email: { type: 'string', format: 'email' },
                      token: { type: 'string' },
                      expiresAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
          security: [],
        },
      },
      '/api/v1/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Get current user',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Current user info',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      userId: { type: 'string', format: 'uuid' },
                      companyId: { type: 'string', format: 'uuid' },
                      role: { type: 'string', enum: ['admin', 'interviewer'] },
                      email: { type: 'string', format: 'email' },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },

      '/api/v1/upload': {
        post: {
          tags: ['Upload'],
          summary: 'Upload a resume',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['resume', 'positionId', 'applicantEmail', 'applicantName'],
                  properties: {
                    resume: { type: 'string', format: 'binary', description: 'Resume file' },
                    positionId: { type: 'string', format: 'uuid' },
                    applicantEmail: { type: 'string', format: 'email' },
                    applicantName: { type: 'string' },
                    supplementaryInfo: { type: 'string', description: 'Optional supplementary info' },
                  },
                },
              },
            },
          },
          responses: {
            '202': {
              description: 'Upload accepted for processing',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      applicationId: { type: 'string', format: 'uuid' },
                      positionId: { type: 'string', format: 'uuid' },
                      applicantEmail: { type: 'string', format: 'email' },
                      applicantName: { type: 'string' },
                      fileName: { type: 'string' },
                      fileSize: { type: 'integer' },
                      status: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
          security: [],
        },
      },
      '/api/v1/upload/status/{applicationId}': {
        get: {
          tags: ['Upload'],
          summary: 'Get upload/processing status',
          parameters: [
            { name: 'applicationId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Status',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      applicationId: { type: 'string', format: 'uuid' },
                      status: { type: 'string' },
                      assignedInterviewerId: { type: 'string', format: 'uuid', nullable: true },
                    },
                  },
                },
              },
            },
          },
          security: [],
        },
      },

      '/api/v1/applicants': {
        get: {
          tags: ['Applicants'],
          summary: 'List applicants',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'positionId', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'status', in: 'query', schema: { type: 'string' } },
            { name: 'tag', in: 'query', schema: { type: 'string' } },
            { name: 'round', in: 'query', schema: { type: 'string' } },
            { name: 'interviewerId', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: {
            '200': {
              description: 'Paginated list of applicants',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      items: { type: 'array', items: { $ref: '#/components/schemas/Applicant' } },
                      total: { type: 'integer' },
                      page: { type: 'integer' },
                      pageSize: { type: 'integer' },
                      totalPages: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/applicants/{id}': {
        get: {
          tags: ['Applicants'],
          summary: 'Get applicant details',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Applicant with tags, notes, and result',
              content: {
                'application/json': {
                  schema: {
                    oneOf: [
                      {
                        type: 'object',
                        properties: {
                          applicant: {
                            allOf: [
                              { $ref: '#/components/schemas/Applicant' },
                              {
                                type: 'object',
                                properties: {
                                  tags: { type: 'array', items: { $ref: '#/components/schemas/Tag' } },
                                  notes: { type: 'array', items: { $ref: '#/components/schemas/Note' } },
                                },
                              },
                            ],
                          },
                          result: { type: 'object', nullable: true },
                        },
                      },
                      { type: 'null' },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/applicants/{id}/status': {
        patch: {
          tags: ['Applicants'],
          summary: 'Update applicant status',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status'],
                  properties: {
                    status: { type: 'string', enum: ['approved', 'rejected'] },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Status updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      applicantId: { type: 'string', format: 'uuid' },
                      status: { type: 'string', enum: ['approved', 'rejected'] },
                      updatedAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/applicants/{id}/tags': {
        post: {
          tags: ['Applicants'],
          summary: 'Add tag to applicant',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['tagId'],
                  properties: {
                    tagId: { type: 'string', format: 'uuid' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Tag added',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      applicantId: { type: 'string', format: 'uuid' },
                      tagId: { type: 'string', format: 'uuid' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/applicants/{id}/tags/{tagId}': {
        delete: {
          tags: ['Applicants'],
          summary: 'Remove tag from applicant',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
            { name: 'tagId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Tag removed',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      applicantId: { type: 'string', format: 'uuid' },
                      tagId: { type: 'string', format: 'uuid' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      '/api/v1/interviewers': {
        get: {
          tags: ['Interviewers'],
          summary: 'List interviewers',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'positionId', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'roundId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'List of interviewers',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        email: { type: 'string', format: 'email' },
                        name: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                        positionCount: { type: 'integer' },
                        currentWorkload: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Interviewers'],
          summary: 'Create interviewer (admin)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'name', 'positionIds'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    name: { type: 'string' },
                    positionIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
                    roundIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Interviewer created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      interviewerId: { type: 'string', format: 'uuid' },
                      email: { type: 'string', format: 'email' },
                      name: { type: 'string' },
                      tempPassword: { type: 'string' },
                      positionIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
                      roundIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
                      publicKey: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/interviewers/{id}': {
        get: {
          tags: ['Interviewers'],
          summary: 'Get interviewer details',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Interviewer with positions, rounds, and workload',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      email: { type: 'string', format: 'email' },
                      name: { type: 'string' },
                      positions: { type: 'array', items: { type: 'object' } },
                      rounds: { type: 'array', items: { type: 'object' } },
                      workload: { type: 'array', items: { type: 'object' } },
                      totalWorkload: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
        patch: {
          tags: ['Interviewers'],
          summary: 'Update interviewer (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    email: { type: 'string', format: 'email' },
                    name: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Interviewer updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      email: { type: 'string', format: 'email' },
                      name: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        delete: {
          tags: ['Interviewers'],
          summary: 'Delete interviewer (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Interviewer deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      deletedId: { type: 'string', format: 'uuid' },
                      reassignedCount: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/interviewers/{id}/positions': {
        post: {
          tags: ['Interviewers'],
          summary: 'Assign position to interviewer (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['positionId'],
                  properties: {
                    positionId: { type: 'string', format: 'uuid' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Position assigned',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      interviewerId: { type: 'string', format: 'uuid' },
                      positionId: { type: 'string', format: 'uuid' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/interviewers/{id}/positions/{positionId}': {
        delete: {
          tags: ['Interviewers'],
          summary: 'Remove position from interviewer (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
            { name: 'positionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Position removed',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      reassignedCount: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/interviewers/{id}/workload': {
        get: {
          tags: ['Interviewers'],
          summary: 'Get interviewer workload',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Workload details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      interviewerId: { type: 'string', format: 'uuid' },
                      positions: { type: 'array', items: { type: 'object' } },
                      totalAssigned: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/interviewers/{id}/assigned-applicants': {
        get: {
          tags: ['Interviewers'],
          summary: 'Get applicants assigned to interviewer',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
            { name: 'status', in: 'query', schema: { type: 'string' } },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
          ],
          responses: {
            '200': {
              description: 'Paginated list of assigned applicants',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      items: { type: 'array', items: { $ref: '#/components/schemas/Applicant' } },
                      total: { type: 'integer' },
                      page: { type: 'integer' },
                      pageSize: { type: 'integer' },
                      totalPages: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/interviewers/{id}/reset-key': {
        post: {
          tags: ['Interviewers'],
          summary: 'Reset interviewer encryption key',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Key reset',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      interviewerId: { type: 'string', format: 'uuid' },
                      newKeyPreview: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      '/api/v1/positions': {
        get: {
          tags: ['Positions'],
          summary: 'List positions',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'List of positions',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        criteria: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                        applicant_count: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Positions'],
          summary: 'Create position (admin)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'criteria'],
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    criteria: { type: 'string', description: 'Eligibility criteria' },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Position created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      companyId: { type: 'string', format: 'uuid' },
                      name: { type: 'string' },
                      description: { type: 'string' },
                      criteria: { type: 'string' },
                      createdAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/positions/{id}': {
        get: {
          tags: ['Positions'],
          summary: 'Get position details',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Position with interviewers and applicant count',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/Position' },
                      {
                        type: 'object',
                        properties: {
                          interviewers: { type: 'array', items: { $ref: '#/components/schemas/Interviewer' } },
                          applicantCount: { type: 'integer' },
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
        patch: {
          tags: ['Positions'],
          summary: 'Update position (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    criteria: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Position updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                    },
                  },
                },
              },
            },
          },
        },
        delete: {
          tags: ['Positions'],
          summary: 'Delete position (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Position deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/positions/{id}/interviewers': {
        post: {
          tags: ['Positions'],
          summary: 'Assign interviewer to position (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['interviewerId'],
                  properties: {
                    interviewerId: { type: 'string', format: 'uuid' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Interviewer assigned',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      positionId: { type: 'string', format: 'uuid' },
                      interviewerId: { type: 'string', format: 'uuid' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/positions/{id}/interviewers/{interviewerId}': {
        delete: {
          tags: ['Positions'],
          summary: 'Remove interviewer from position (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
            { name: 'interviewerId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Interviewer removed',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      '/api/v1/rounds': {
        get: {
          tags: ['Rounds'],
          summary: 'List rounds',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'positionId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'List of rounds',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        round_number: { type: 'integer' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        position_id: { type: 'string', format: 'uuid' },
                        created_at: { type: 'string', format: 'date-time' },
                        interviewerCount: { type: 'integer' },
                        applicantCount: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Rounds'],
          summary: 'Create round (admin)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['roundNumber', 'name'],
                  properties: {
                    roundNumber: { type: 'integer' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    positionId: { type: 'string', format: 'uuid' },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Round created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      roundNumber: { type: 'integer' },
                      name: { type: 'string' },
                      description: { type: 'string' },
                      positionId: { type: 'string', format: 'uuid', nullable: true },
                      createdAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/rounds/{id}': {
        get: {
          tags: ['Rounds'],
          summary: 'Get round details',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Round with interviewers and applicants',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/Round' },
                      {
                        type: 'object',
                        properties: {
                          interviewers: { type: 'array', items: { $ref: '#/components/schemas/Interviewer' } },
                          applicants: { type: 'array', items: { $ref: '#/components/schemas/Applicant' } },
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
        patch: {
          tags: ['Rounds'],
          summary: 'Update round (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    roundNumber: { type: 'integer' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Round updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                    },
                  },
                },
              },
            },
          },
        },
        delete: {
          tags: ['Rounds'],
          summary: 'Delete round (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Round deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/rounds/{id}/interviewers': {
        post: {
          tags: ['Rounds'],
          summary: 'Assign interviewer to round (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['interviewerId'],
                  properties: {
                    interviewerId: { type: 'string', format: 'uuid' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Interviewer assigned',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      roundId: { type: 'string', format: 'uuid' },
                      interviewerId: { type: 'string', format: 'uuid' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/rounds/{id}/interviewers/{interviewerId}': {
        delete: {
          tags: ['Rounds'],
          summary: 'Remove interviewer from round (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
            { name: 'interviewerId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Interviewer removed',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/rounds/{id}/applicants/{applicantId}/advance': {
        post: {
          tags: ['Rounds'],
          summary: 'Advance applicant to next round (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
            { name: 'applicantId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Applicant advanced',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      applicantId: { type: 'string', format: 'uuid' },
                      previousRoundId: { type: 'string', format: 'uuid' },
                      newRoundId: { type: 'string', format: 'uuid' },
                      newRoundNumber: { type: 'integer' },
                      assignedInterviewerId: { type: 'string', format: 'uuid' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      '/api/v1/tags': {
        get: {
          tags: ['Tags'],
          summary: 'List tags',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'scope', in: 'query', schema: { type: 'string', enum: ['global', 'local'] } },
          ],
          responses: {
            '200': {
              description: 'List of tags',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Tag' },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Tags'],
          summary: 'Create tag',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'color', 'scope'],
                  properties: {
                    name: { type: 'string' },
                    color: { type: 'string' },
                    scope: { type: 'string', enum: ['global', 'local'] },
                    createdByInterviewerId: { type: 'string', format: 'uuid' },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Tag created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      name: { type: 'string' },
                      color: { type: 'string' },
                      scope: { type: 'string', enum: ['global', 'local'] },
                      isApproved: { type: 'boolean' },
                      createdAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/tags/{id}': {
        patch: {
          tags: ['Tags'],
          summary: 'Update tag',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    color: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Tag updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      name: { type: 'string' },
                      color: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        delete: {
          tags: ['Tags'],
          summary: 'Delete tag',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Tag deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/tags/{id}/approve': {
        post: {
          tags: ['Tags'],
          summary: 'Approve tag (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Tag approved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      tagId: { type: 'string', format: 'uuid' },
                      isApproved: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/tags/{id}/decline': {
        post: {
          tags: ['Tags'],
          summary: 'Decline tag (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Tag declined',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      '/api/v1/notes/{applicantId}': {
        get: {
          tags: ['Notes'],
          summary: 'List notes for applicant',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'applicantId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'List of notes',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Note' },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/notes': {
        post: {
          tags: ['Notes'],
          summary: 'Create note',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['applicantId', 'content'],
                  properties: {
                    applicantId: { type: 'string', format: 'uuid' },
                    content: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Note created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      applicantId: { type: 'string', format: 'uuid' },
                      interviewerId: { type: 'string', format: 'uuid' },
                      content: { type: 'string' },
                      createdAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/notes/{id}': {
        patch: {
          tags: ['Notes'],
          summary: 'Update note',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['content'],
                  properties: {
                    content: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Note updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      content: { type: 'string' },
                      updatedAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
        delete: {
          tags: ['Notes'],
          summary: 'Delete note',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Note deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      '/api/v1/messages/{applicantId}': {
        get: {
          tags: ['Messages'],
          summary: 'List messages for applicant',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'applicantId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'List of messages',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      allOf: [
                        { $ref: '#/components/schemas/Message' },
                        {
                          type: 'object',
                          properties: {
                            senderName: { type: 'string' },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/messages': {
        post: {
          tags: ['Messages'],
          summary: 'Send message',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['applicantId', 'content'],
                  properties: {
                    applicantId: { type: 'string', format: 'uuid' },
                    content: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Message sent',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      applicantId: { type: 'string', format: 'uuid' },
                      senderType: { type: 'string', enum: ['admin', 'interviewer'] },
                      content: { type: 'string' },
                      createdAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      '/api/v1/setup/status': {
        get: {
          tags: ['Setup'],
          summary: 'Get setup wizard status (admin)',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Setup status',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SetupStatus' },
                },
              },
            },
          },
        },
      },
      '/api/v1/setup/database': {
        post: {
          tags: ['Setup'],
          summary: 'Configure database (admin)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['backend'],
                  properties: {
                    backend: { type: 'string', enum: ['sqlite', 'postgresql'] },
                    connectionString: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Database configured',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      backend: { type: 'string' },
                      configured: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/setup/branding': {
        post: {
          tags: ['Setup'],
          summary: 'Configure branding (admin)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'themeStyle'],
                  properties: {
                    name: { type: 'string', description: 'Company display name' },
                    themeStyle: { type: 'string', enum: ['light', 'dark', 'auto'] },
                    primaryColor: { type: 'string', description: 'Hex color' },
                    logoUrl: { type: 'string', format: 'uri' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Branding configured',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      themeStyle: { type: 'string' },
                      primaryColor: { type: 'string' },
                      logoUrl: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/setup/model-provider': {
        post: {
          tags: ['Setup'],
          summary: 'Configure AI model provider (admin)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['role', 'provider', 'modelName'],
                  properties: {
                    role: { type: 'string', description: 'Purpose of this model config' },
                    provider: { type: 'string', enum: ['openai', 'anthropic', 'azure', 'local'] },
                    endpointUrl: { type: 'string', format: 'uri' },
                    apiKey: { type: 'string' },
                    modelName: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Model provider configured',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      role: { type: 'string' },
                      provider: { type: 'string' },
                      modelName: { type: 'string' },
                      configured: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/setup/interviewer': {
        post: {
          tags: ['Setup'],
          summary: 'Create interviewer during setup (admin)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'name', 'positionIds'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    name: { type: 'string' },
                    positionIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
                    roundIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Interviewer created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      interviewerId: { type: 'string', format: 'uuid' },
                      email: { type: 'string', format: 'email' },
                      name: { type: 'string' },
                      tempPassword: { type: 'string' },
                      positionIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
                      roundIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/setup/skip-interviewers': {
        post: {
          tags: ['Setup'],
          summary: 'Skip interviewer setup (admin)',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Skipped',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      skipped: { type: 'boolean', example: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/setup/interviewer/download/{id}': {
        get: {
          tags: ['Setup'],
          summary: 'Download interviewer config (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Download info',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      downloadUrl: { type: 'string', format: 'uri' },
                      config: { type: 'object' },
                      expiresAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      '/api/v1/features': {
        get: {
          tags: ['Features'],
          summary: 'List feature flags (admin)',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Feature flags',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/FeatureFlag' },
                  },
                },
              },
            },
          },
        },
        patch: {
          tags: ['Features'],
          summary: 'Update feature flag (admin)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['feature', 'isEnabled'],
                  properties: {
                    feature: { type: 'string' },
                    isEnabled: { type: 'boolean' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Updated feature flags',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/FeatureFlag' },
                  },
                },
              },
            },
          },
        },
      },

      '/api/v1/custom-ui': {
        get: {
          tags: ['Custom UI'],
          summary: 'List custom UI packages',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'List of custom UI packages',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/CustomUI' },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/custom-ui/defaults': {
        get: {
          tags: ['Custom UI'],
          summary: 'List available default templates',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Default templates',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                      },
                      additionalProperties: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/custom-ui/defaults/{template}/install': {
        post: {
          tags: ['Custom UI'],
          summary: 'Install a default template',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'template', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['platform'],
                  properties: {
                    platform: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Template installed',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      platform: { type: 'string' },
                      name: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/custom-ui/{platform}': {
        get: {
          tags: ['Custom UI'],
          summary: 'Get active custom UI for platform',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'platform', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Custom UI package or null',
              content: {
                'application/json': {
                  schema: {
                    oneOf: [
                      { $ref: '#/components/schemas/CustomUI' },
                      { type: 'null' },
                    ],
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Custom UI'],
          summary: 'Upload custom UI for platform',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'platform', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'files'],
                  properties: {
                    name: { type: 'string' },
                    version: { type: 'string' },
                    files: { type: 'object', description: 'Map of filename to file content' },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Custom UI uploaded',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      platform: { type: 'string' },
                      name: { type: 'string' },
                      version: { type: 'string' },
                      fileCount: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/custom-ui/{platform}/activate/{id}': {
        post: {
          tags: ['Custom UI'],
          summary: 'Activate a custom UI version',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'platform', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Activated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/custom-ui/{platform}/{id}': {
        delete: {
          tags: ['Custom UI'],
          summary: 'Delete a custom UI version',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'platform', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/custom-ui/{platform}/check-update': {
        get: {
          tags: ['Custom UI'],
          summary: 'Check for custom UI updates',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'platform', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'currentVersion', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Update check result',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      updateAvailable: { type: 'boolean' },
                      currentVersion: { type: 'string' },
                      latestVersion: { type: 'string' },
                      manifest: { type: 'object', nullable: true },
                      updatedAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/custom-ui/{platform}/files/{filePath}': {
        get: {
          tags: ['Custom UI'],
          summary: 'Serve a custom UI file',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'platform', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'filePath', in: 'path', required: true, schema: { type: 'string' }, description: 'Path to the file within the UI package' },
          ],
          responses: {
            '200': {
              description: 'Raw file content',
              content: {
                '*/*': {
                  schema: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
      },

      '/api/v1/status/{applicationId}': {
        get: {
          tags: ['Status'],
          summary: 'Get public application status',
          security: [],
          parameters: [
            { name: 'applicationId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Application status',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      applicationId: { type: 'string', format: 'uuid' },
                      status: { type: 'string' },
                      statusMessage: { type: 'string' },
                      position: { type: 'string' },
                      company: { type: 'string' },
                      currentRound: { type: 'string', nullable: true },
                      submittedAt: { type: 'string', format: 'date-time' },
                      lastUpdated: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      '/api/v1/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check',
          security: [],
          responses: {
            '200': {
              description: 'Health status',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'ok' },
                      timestamp: { type: 'string', format: 'date-time' },
                      version: { type: 'string' },
                      database: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: [
    `${__dirname}/routes/*.ts`,
    `${__dirname}/routes/*.js`,
    `${__dirname}/../src/routes/*.ts`,
  ],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
