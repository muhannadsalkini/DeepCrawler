# 🕷️ DeepCrawler

A production-ready web crawler API built with Node.js and TypeScript. Fast, scalable, and respectful.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## ✨ Features

- **🎯 Single URL Scraping** - Extract content, title, and links from any URL
- **📦 Batch Processing** - Scrape multiple URLs concurrently  
- **🌐 BFS Crawling** - Intelligent breadth-first search algorithm
- **⚡ Async Job System** - Track progress in real-time with job IDs
- **🛡️ Safety First** - Rate limiting, robots.txt, size limits, timeouts
- **📊 Real-time Metrics** - Pages scraped, links discovered, errors tracked
- **🔄 Redis Ready** - Abstracted storage for horizontal scaling
- **🚀 Production Ready** - PM2, Docker, clustering support

## 🚀 Quick Start

### Installation

```bash
git clone <repository-url> deepcrawler
cd deepcrawler
npm install
cp .env.example .env
```

### Development

```bash
npm run dev
```

Server runs at `http://localhost:3000`

### Production

```bash
npm run build
npm start
```

## 📖 API Usage Examples

### 1. Single URL Scrape

```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

**Response:**
```json
{
  "url": "https://example.com/",
  "title": "Example Domain",
  "text": "Example Domain This domain is for use...",
  "links": ["https://iana.org/domains/example"],
  "meta": {}
}
```

### 2. Batch Scrape

```bash
curl -X POST http://localhost:3000/api/scrape/batch \
  -H "Content-Type: application/json" \
  -d '{
    "urls": ["https://example.com", "https://example.org"],
    "concurrency": 2
  }'
```

### 3. Start Crawl Job

```bash
curl -X POST http://localhost:3000/api/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "startUrl": "https://example.com",
    "strategy": "domain",
    "maxDepth": 3,
    "maxPages": 50
  }'
```

**Response (202 Accepted):**
```json
{
  "jobId": "job_1770795898430_c694653ea97c",
  "status": "pending",
  "message": "Crawl job created successfully"
}
```

### 4. Check Job Status

```bash
curl http://localhost:3000/api/crawl/job_1770795898430_c694653ea97c
```

**Response (Running):**
```json
{
  "jobId": "job_1770795898430_c694653ea97c",
  "status": "running",
  "metrics": {
    "pagesScraped": 15,
    "linksDiscovered": 87,
    "errors": 0,
    "currentDepth": 2
  }
}
```

### 5. Get Job Results

```bash
curl http://localhost:3000/api/crawl/job_1770795898430_c694653ea97c/result
```

### JavaScript Example

```javascript
async function crawlWebsite(url) {
  // 1. Start crawl
  const { jobId } = await fetch('http://localhost:3000/api/crawl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startUrl: url,
      strategy: 'domain',
      maxDepth: 2,
      maxPages: 20
    })
  }).then(r => r.json());
  
  console.log(`Job created: ${jobId}`);
  
  // 2. Poll for completion
  let job;
  do {
    await new Promise(resolve => setTimeout(resolve, 2000));
    job = await fetch(`http://localhost:3000/api/crawl/${jobId}`)
      .then(r => r.json());
    console.log(`Status: ${job.status}, Pages: ${job.metrics?.pagesScraped || 0}`);
  } while (job.status === 'pending' || job.status === 'running');
  
  // 3. Get results
  if (job.status === 'completed') {
    const { result } = await fetch(
      `http://localhost:3000/api/crawl/${jobId}/result`
    ).then(r => r.json());
    
    console.log(`Total pages: ${result.pages.length}`);
    return result;
  }
}
```

## 🚀 Deployment

### Option 1: PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Build application
npm run build

# Start with PM2 cluster mode
pm2 start dist/server.js --name deepcrawler -i max
pm2 save
pm2 startup
```

**PM2 Commands:**
```bash
pm2 status              # Check status
pm2 logs deepcrawler    # View logs
pm2 restart deepcrawler # Restart
pm2 monit               # Monitor
```

### Option 2: Docker

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  deepcrawler:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - STORAGE_TYPE=redis
      - REDIS_HOST=redis
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

**Deploy:**
```bash
docker-compose up -d
docker-compose logs -f deepcrawler
```

### Option 3: Manual

```bash
# Build
npm run build

# Start
NODE_ENV=production node dist/server.js
```

## ⚙️ Configuration

Key environment variables in `.env`:

```bash
# Server
PORT=3000
NODE_ENV=production

# Storage
STORAGE_TYPE=memory  # or 'redis' for production

# Redis (if using Redis)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password

# Safety & Politeness
RESPECT_ROBOTS_TXT=true
MIN_REQUEST_TIME=1000
DEFAULT_TIMEOUT=10000
MAX_RESPONSE_SIZE=10485760

# Limits
DEFAULT_MAX_DEPTH=3
DEFAULT_MAX_PAGES=100
DEFAULT_CONCURRENCY=5
```

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/scrape` | POST | Single URL scrape |
| `/api/scrape/batch` | POST | Batch scrape |
| `/api/crawl` | POST | Start crawl job |
| `/api/crawl/:jobId` | GET | Job status |
| `/api/crawl/:jobId/result` | GET | Job results |

## �️ Safety Features

- ✅ Request timeout (10s default)
- ✅ Response size limit (10MB default)
- ✅ Rate limiting (1 req/sec default)
- ✅ Robots.txt compliance (optional)
- ✅ Private IP blocking
- ✅ Depth & page limits
- ✅ User-Agent identification

## 📈 Scaling

DeepCrawler is ready for horizontal scaling:

1. **Enable Redis** - Set `STORAGE_TYPE=redis`
2. **Run Multiple Instances** - PM2 cluster or Docker scaling
3. **Add Load Balancer** - Nginx or cloud LB
4. **Monitor** - Logs, metrics, health checks

### Nginx Load Balancer

```nginx
upstream deepcrawler {
    least_conn;
    server localhost:3001;
    server localhost:3002;
    server localhost:3003;
}

server {
    listen 80;
    server_name crawler.example.com;

    location / {
        proxy_pass http://deepcrawler;
        proxy_set_header Host $host;
        proxy_read_timeout 300s;
    }
}
```

## 🏗️ Architecture

```
API Layer → Job Manager → Crawl Engine → Fetcher/Parser
                              ↓
                        BFS Queue + Visited Set
                              ↓
                        Storage (Memory/Redis)
```

### Crawl Strategies

**Domain Strategy** - Stays within same domain  
**All Strategy** - Follows all links

## 🔧 Development

```bash
npm run dev          # Development mode
npm run build        # Build TypeScript
npm run type-check   # Type checking
npm run lint         # Lint code
npm run lint:fix     # Fix linting
npm run format       # Format code
npm test             # Run tests
```

## 📚 Documentation

- **[Task Breakdown](./task.md)** - Complete development checklist  
- **[Architecture Guide](./ARCHITECTURE.md)** - Technical design
- **[Development Guide](./DEVELOPMENT.md)** - Contributing workflow

## 🙏 Acknowledgments

Built with:
- [Fastify](https://www.fastify.io/) - Web framework
- [Undici](https://github.com/nodejs/undici) - HTTP client
- [Cheerio](https://cheerio.js.org/) - HTML parsing
- [Bottleneck](https://github.com/SGrondin/bottleneck) - Rate limiting
- [Zod](https://zod.dev/) - Validation

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for the web crawling community**
