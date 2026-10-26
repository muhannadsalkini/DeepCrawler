# Development Guide

## Prerequisites

- **Node.js**: 20.x or higher
- **npm**: 9.x or higher
- **Git**: For version control

## Initial Setup

### 1. Clone Repository

```bash
cd /Users/muhannadsalkini/DeepCrawler
```

### 2. Initialize Project

```bash
# Initialize npm project
npm init -y

# Install core dependencies
npm install fastify@^4.25.0 undici@^6.6.0 cheerio@^1.0.0-rc.12 zod@^3.22.0 bottleneck@^2.19.5

# Install dev dependencies
npm install -D typescript@^5.3.0 @types/node@^20.11.0 tsx@^4.7.0 \
  eslint@^8.56.0 @typescript-eslint/parser@^6.19.0 @typescript-eslint/eslint-plugin@^6.19.0 \
  prettier@^3.2.0 vitest@^1.2.0
```

### 3. Configure TypeScript

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 4. Configure ESLint

Create `.eslintrc.json`:

```json
{
  "parser": "@typescript-eslint/parser",
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module"
  },
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-console": "warn"
  }
}
```

### 5. Configure Prettier

Create `.prettierrc`:

```json
{
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2,
  "semi": true,
  "printWidth": 100
}
```

### 6. Update package.json

Add scripts:

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "format": "prettier --write \"src/**/*.ts\"",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "type-check": "tsc --noEmit"
  }
}
```

### 7. Environment Variables

Create `.env.example`:

```bash
# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Crawler Defaults
DEFAULT_MAX_DEPTH=3
DEFAULT_MAX_PAGES=100
DEFAULT_CONCURRENCY=5
DEFAULT_TIMEOUT=10000

# Rate Limiting
RATE_LIMIT_MAX_CONCURRENT=2
RATE_LIMIT_MIN_TIME=100

# Safety
MAX_RESPONSE_SIZE=10485760
USER_AGENT="DeepCrawler/1.0 (+https://yourwebsite.com/bot)"
RESPECT_ROBOTS_TXT=false

# Logging
LOG_LEVEL=info
```

Create `.env` (copy from example):

```bash
cp .env.example .env
```

### 8. Git Setup

Create `.gitignore`:

```
# Dependencies
node_modules/

# Build output
dist/

# Environment
.env
.env.local

# Logs
logs/
*.log

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Test coverage
coverage/
```

## Project Structure

Create the folder structure:

```bash
mkdir -p src/{api/routes,crawler,jobs,utils,types}
mkdir -p tests/{unit,integration,e2e}
```

Your structure should look like:

```
DeepCrawler/
├── src/
│   ├── api/
│   │   └── routes/
│   ├── crawler/
│   ├── jobs/
│   ├── utils/
│   ├── types/
│   └── server.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env
├── .env.example
├── .eslintrc.json
├── .gitignore
├── .prettierrc
├── package.json
├── tsconfig.json
└── README.md
```

## Development Workflow

### Phase-by-Phase Development

Follow the 8 phases outlined in the plan:

#### Phase 1: Project Setup ✅

1. Complete setup steps above
2. Create health endpoint
3. Test build and dev server

#### Phase 2: Single URL Scraper

Start with these files:

```bash
touch src/crawler/fetcher.ts
touch src/crawler/parser.ts
touch src/crawler/extractor.ts
touch src/crawler/normalizer.ts
touch src/api/routes/scrape.ts
```

#### Phase 3: Batch Scraping

Extend scrape route to support batches.

#### Phase 4: Crawl Engine

```bash
touch src/crawler/engine.ts
touch src/crawler/queue.ts
touch src/crawler/rules.ts
touch src/crawler/metrics.ts
```

#### Phase 5: Job System

```bash
touch src/jobs/job-manager.ts
touch src/api/routes/crawl.ts
touch src/api/routes/status.ts
```

#### Phase 6-8: Safety, Redis Readiness, Documentation

Complete remaining features and polish.

## Running the Project

### Development Mode

```bash
npm run dev
```

Server will restart on file changes.

### Production Build

```bash
npm run build
npm start
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
npm run lint:fix
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- src/crawler/normalizer.test.ts
```

## Testing Strategy

### Unit Tests

Test individual functions in isolation.

**Example**: `tests/unit/normalizer.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeUrl } from '../../src/crawler/normalizer';

describe('normalizeUrl', () => {
  it('should convert to lowercase', () => {
    expect(normalizeUrl('https://Example.COM/Page')).toBe('https://example.com/page');
  });

  it('should remove trailing slash', () => {
    expect(normalizeUrl('https://example.com/page/')).toBe('https://example.com/page');
  });

  it('should sort query parameters', () => {
    expect(normalizeUrl('https://example.com/page?b=2&a=1')).toBe(
      'https://example.com/page?a=1&b=2'
    );
  });
});
```

### Integration Tests

Test module interactions.

**Example**: `tests/integration/fetcher.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { fetch } from '../../src/crawler/fetcher';

describe('Fetcher Integration', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    server = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body>Test</body></html>');
    });
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(() => {
    server.close();
  });

  it('should fetch HTML successfully', async () => {
    const result = await fetch(baseUrl);
    expect(result.statusCode).toBe(200);
    expect(result.html).toContain('Test');
  });
});
```

### E2E Tests

Test complete workflows.

**Example**: `tests/e2e/crawl.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { build } from '../../src/server';

describe('Crawl E2E', () => {
  let server;

  beforeAll(async () => {
    server = await build();
    await server.listen({ port: 0 });
  });

  afterAll(async () => {
    await server.close();
  });

  it('should complete a crawl job', async () => {
    // Start job
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/crawl',
      payload: {
        startUrl: 'https://example.com',
        strategy: 'domain',
        maxPages: 10,
      },
    });

    expect(createRes.statusCode).toBe(202);
    const { jobId } = JSON.parse(createRes.payload);

    // Poll until complete
    let status;
    do {
      await new Promise((r) => setTimeout(r, 500));
      const statusRes = await server.inject({
        method: 'GET',
        url: `/api/crawl/${jobId}`,
      });
      status = JSON.parse(statusRes.payload).status;
    } while (status === 'running');

    expect(status).toBe('completed');
  });
});
```

## Debugging

### VS Code Launch Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Dev Server",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "skipFiles": ["<node_internals>/**"],
      "env": {
        "NODE_ENV": "development"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["test", "--", "--run"],
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

### Logging

Use structured logging:

```typescript
// src/utils/logger.ts
export const logger = {
  info: (msg: string, meta?: object) => console.log(JSON.stringify({ level: 'info', msg, ...meta })),
  error: (msg: string, error?: Error) => console.error(JSON.stringify({ level: 'error', msg, error: error?.message })),
  debug: (msg: string, meta?: object) => process.env.LOG_LEVEL === 'debug' && console.log(JSON.stringify({ level: 'debug', msg, ...meta })),
};
```

## Performance Profiling

### Node.js Inspector

```bash
node --inspect dist/server.js
```

Open `chrome://inspect` in Chrome.

### Flamegraphs

```bash
npm install -g clinic
clinic flame -- node dist/server.js
```

## Common Issues

### Port Already in Use

```bash
# Find process using port 3000
lsof -ti:3000 | xargs kill
```

### TypeScript Errors

```bash
# Clean build
rm -rf dist/
npm run build
```

### Memory Issues

Increase Node.js memory:

```bash
node --max-old-space-size=4096 dist/server.js
```

## Best Practices

1. **Type Everything**: No `any` types
2. **Small Functions**: Keep functions under 50 lines
3. **Error Handling**: Always handle errors explicitly
4. **Test Coverage**: Aim for >80% coverage
5. **Code Reviews**: Use PRs even for solo work
6. **Commit Often**: Small, focused commits
7. **Document Decisions**: Add comments for non-obvious logic

## Next Steps

1. Complete Phase 1 (setup)
2. Create health endpoint
3. Test build pipeline
4. Move to Phase 2 (single URL scraper)

See [task.md](./task.md) for the complete checklist.

---

**Quick Reference**:
- [README](./README.md) - Project overview
- [ARCHITECTURE](./ARCHITECTURE.md) - Technical design
- [API](./API.md) - API documentation
