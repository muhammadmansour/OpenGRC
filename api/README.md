# Morage Backend API

A Node.js/Express backend API for the Morage audit platform.

## Quick Start

```bash
# Navigate to api directory
cd api

# Install dependencies
npm install

# Copy environment file and configure
cp .env.example .env  # Edit .env with your values

# Start development server
npm run dev

# Start production server
npm start
```

## Environment Variables

Create a `.env` file with the following variables:

```env
# Server
PORT=3000
NODE_ENV=development

# External APIs
AUTH_API_URL=https://api-gcp.col8.ai
LLM_API_URL=https://llm-gcp.col8.ai
AUTH_EMAIL=your_service_email
AUTH_PASSWORD=your_service_password

# Default Collection
DEFAULT_COLLECTION_ID=118

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key

# JWT
JWT_SECRET=your_jwt_secret_min_32_chars
JWT_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=7d

# CORS
CORS_ORIGINS=http://localhost:5173,https://your-frontend.netlify.app
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signin` | User login |
| POST | `/api/auth/refresh` | Refresh token |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/verify` | Verify token |

### Files
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/files/upload-url` | Generate signed upload URL |
| POST | `/api/files/process` | Process uploaded file |
| GET | `/api/files/:id/status` | Get file status |
| POST | `/api/files/:id/wait-ready` | Wait for file ready |
| GET | `/api/files` | List files |
| GET | `/api/files/:id` | Get file info |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/stream` | Stream AI response (SSE) |
| POST | `/api/chat/message` | Non-streaming message |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me/settings` | Get user settings |
| PUT | `/api/users/me/settings` | Update settings |
| GET | `/api/users/me/selected-expert` | Get selected expert |
| PUT | `/api/users/me/selected-expert` | Set selected expert |

### Experts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/experts` | List experts |
| GET | `/api/experts/:id` | Get expert |
| POST | `/api/experts` | Create expert |
| PUT | `/api/experts/:id` | Update expert |
| DELETE | `/api/experts/:id` | Delete expert |

### Standards
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/standards/:expertId` | Get standards for expert |
| POST | `/api/standards/:expertId` | Save standards |

### Submissions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/submissions` | Create submission |
| GET | `/api/submissions` | List submissions |
| GET | `/api/submissions/stats` | Get statistics |
| GET | `/api/submissions/:id` | Get submission |
| PUT | `/api/submissions/:id/status` | Update status |
| PUT | `/api/submissions/:id/analysis` | Save AI analysis |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects` | Create project |
| GET | `/api/projects` | List projects |
| GET | `/api/projects/:id` | Get project |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |
| GET | `/api/projects/:id/analyses` | Get analyses |
| POST | `/api/projects/:id/analyses` | Save analysis |

### Domains
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/domains/references/:expertId` | Get references |
| POST | `/api/domains/references` | Save reference |
| DELETE | `/api/domains/references/:id` | Delete reference |
| GET | `/api/domains/templates/:expertId` | Get templates |
| POST | `/api/domains/templates` | Save template |
| DELETE | `/api/domains/templates/:id` | Delete template |

## Project Structure

```
api/
├── index.js                  # Entry point
├── config/
│   ├── index.js              # Configuration
│   └── database.js           # Supabase client
├── middleware/
│   ├── auth.middleware.js
│   └── error.middleware.js
├── routes/
│   ├── auth.routes.js
│   ├── file.routes.js
│   ├── chat.routes.js
│   ├── user.routes.js
│   ├── expert.routes.js
│   ├── standards.routes.js
│   ├── submission.routes.js
│   ├── project.routes.js
│   └── domain.routes.js
├── services/
│   ├── auth.service.js
│   ├── file.service.js
│   ├── chat.service.js
│   ├── user.service.js
│   ├── expert.service.js
│   ├── standards.service.js
│   ├── submission.service.js
│   ├── project.service.js
│   └── domain.service.js
├── package.json
├── .env.example
└── README.md
```

## Deployment

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 2020
CMD ["node", "index.js"]
```

### Railway / Render

1. Connect your GitHub repository
2. Set build command: `npm install`
3. Set start command: `npm start`
4. Configure environment variables

### Traditional VPS

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start index.js --name morage-api

# Save process list
pm2 save

# Setup startup script
pm2 startup
```

## Frontend Configuration

Update your frontend to point to the backend:

```env
# Frontend .env
VITE_API_BASE_URL=https://api.yourdomain.com
```

Update `netlify.toml`:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://api.yourdomain.com/api/:splat"
  status = 200
  force = true
```
