# 🕷️ DeepCrawler

A production-ready web crawler API built with Node.js and TypeScript. Fast, scalable, and respectful.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## ✨ Features

- **🎯 Single URL Scraping** - Extract content, title, and links from any URL
- **📦 Batch Processing** - Scrape multiple URLs concurrently  
- **🌐 BFS Crawling** - Intelligent breadth-first search algorithm
- **⚡ Async Job System** - Track progress in real-time with job IDs
- **🛡️ Safety First** - Rate limiting, robots.txt, size limits, timeouts
- **📊 Real-time Metrics** - Pages scraped, links discovered, errors tracked
- **🔐 API Key Auth** - Constant-time key check on every route, fail-closed when unconfigured
- **🧩 Pluggable Storage** - Queue and visited-set behind interfaces (in-memory today, Redis-ready design)

## 🚀 Quick Start

### Installation

```bash
git clone https://github.com/muhannadsalkini/DeepCrawler.git
cd DeepCrawler
npm install
cp .env.example .env
```

Set `API_KEY` in `.env` (e.g. `openssl rand -hex 32`). Every request except `GET /health` must send it in the `x-api-key` header.

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

The examples assume `export API_KEY=<your key from .env>`.

### 1. Single URL Scrape

```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "x-api-key: $API_KEY" \
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
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "urls": ["https://example.com", "https://example.org"],
    "concurrency": 2
  }'
```

### 3. Start Crawl Job

```bash
curl -X POST http://localhost:3000/api/crawl \
  -H "x-api-key: $API_KEY" \
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
curl http://localhost:3000/api/crawl/job_1770795898430_c694653ea97c -H "x-api-key: $API_KEY"
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
curl http://localhost:3000/api/crawl/job_1770795898430_c694653ea97c/result -H "x-api-key: $API_KEY"
```

### JavaScript Example

```javascript
async function crawlWebsite(url) {
  // 1. Start crawl
  const { jobId } = await fetch('http://localhost:3000/api/crawl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.API_KEY },
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
    job = await fetch(`http://localhost:3000/api/crawl/${jobId}`, {
      headers: { 'x-api-key': process.env.API_KEY }
    }).then(r => r.json());
    console.log(`Status: ${job.status}, Pages: ${job.metrics?.pagesScraped || 0}`);
  } while (job.status === 'pending' || job.status === 'running');
  
  // 3. Get results
  if (job.status === 'completed') {
    const { result } = await fetch(
      `http://localhost:3000/api/crawl/${jobId}/result`,
      { headers: { 'x-api-key': process.env.API_KEY } }
    ).then(r => r.json());
    
    console.log(`Total pages: ${result.pages.length}`);
    return result;
  }
}
```

## 🚀 Deployment

Crawl jobs are held in process memory, so run a **single instance** per deployment (no cluster mode) until a shared storage backend is added.

### PM2

```bash
npm install -g pm2
npm run build
pm2 start dist/server.js --name deepcrawler
pm2 save
```

```bash
pm2 status              # Check status
pm2 logs deepcrawler    # View logs
pm2 restart deepcrawler # Restart
```

### Manual

```bash
npm run build
NODE_ENV=production node dist/server.js
```

## ⚙️ Configuration

Key environment variables in `.env`:

```bash
# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# Auth (required - the API returns 503 if unset)
API_KEY=change-me-to-a-strong-random-secret

# Jobs
MAX_JOBS=200
MAX_CONCURRENT_JOBS=5
JOB_TTL_MS=3600000
MAX_BATCH_URLS=50

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

See [`.env.example`](.env.example) for the full list with descriptions.

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/scrape` | POST | Single URL scrape |
| `/api/scrape/batch` | POST | Batch scrape |
| `/api/crawl` | POST | Start crawl job |
| `/api/crawl/:jobId` | GET | Job status |
| `/api/crawl/:jobId/result` | GET | Job results |

## 🛡️ Safety Features

- ✅ Request timeout (10s default)
- ✅ Response size limit (10MB default)
- ✅ Rate limiting (1 req/sec default)
- ✅ Robots.txt compliance (optional)
- ✅ API key authentication (constant-time comparison)
- ✅ SSRF guard (private IP and internal host blocking)
- ✅ Per-client API rate limiting and job/batch caps
- ✅ Depth & page limits
- ✅ User-Agent identification

## 📈 Scaling Roadmap

The crawl queue and visited-set are accessed through storage interfaces (`src/storage/`), so a Redis backend can be added without touching the crawl engine. Planned next steps:

1. Redis implementations of the queue, visited-set, and job store
2. Multiple API/worker instances behind a load balancer
3. Optional Playwright fallback for JavaScript-rendered pages

## 🏗️ Architecture

```
API Layer → Job Manager → Crawl Engine → Fetcher/Parser
                              ↓
                        BFS Queue + Visited Set
                              ↓
                        Storage (in-memory)
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
```

## 📚 Documentation

- **[API Reference](docs/API.md)** - Endpoints, request/response schemas
- **[Architecture Guide](docs/ARCHITECTURE.md)** - Technical design
- **[Development Guide](docs/DEVELOPMENT.md)** - Setup and workflow

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
