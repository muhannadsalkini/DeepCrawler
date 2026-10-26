# DeepCrawler API Documentation

## Base URL

```
http://localhost:3000/api
```

## Authentication

Currently no authentication required (to be added in future phases).

---

## Endpoints

### 1. Health Check

Check if the service is running.

**Endpoint**: `GET /health`

**Response**: `200 OK`

```json
{
  "status": "ok",
  "timestamp": 1707305448000
}
```

---

### 2. Single URL Scrape

Scrape a single URL and extract content.

**Endpoint**: `POST /api/scrape`

**Request Body**:

```json
{
  "url": "https://example.com"
}
```

**Response**: `200 OK`

```json
{
  "url": "https://example.com",
  "title": "Example Domain",
  "text": "This domain is for use in illustrative examples...",
  "links": [
    "https://example.com/about",
    "https://example.com/contact",
    "https://www.iana.org/domains/example"
  ],
  "meta": {
    "description": "Example domain for illustrative purposes",
    "keywords": ["example", "domain"]
  }
}
```

**Error Response**: `400 Bad Request`

```json
{
  "error": "Invalid URL format"
}
```

---

### 3. Batch Scrape

Scrape multiple URLs concurrently.

**Endpoint**: `POST /api/scrape/batch`

**Request Body**:

```json
{
  "urls": [
    "https://example.com",
    "https://example.org",
    "https://example.net"
  ],
  "concurrency": 3
}
```

**Parameters**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `urls` | `string[]` | Yes | - | Array of URLs to scrape |
| `concurrency` | `number` | No | 5 | Max parallel requests |

**Response**: `200 OK`

```json
{
  "results": [
    {
      "url": "https://example.com",
      "title": "Example Domain",
      "text": "...",
      "links": ["..."]
    },
    {
      "url": "https://example.org",
      "title": "Example Organization",
      "text": "...",
      "links": ["..."]
    }
  ],
  "stats": {
    "total": 3,
    "success": 2,
    "failed": 1,
    "duration": 2341
  },
  "errors": [
    {
      "url": "https://example.net",
      "error": "Request timeout"
    }
  ]
}
```

---

### 4. Start Crawl Job

Initiate a crawl job with specified strategy and limits.

**Endpoint**: `POST /api/crawl`

**Request Body**:

```json
{
  "startUrl": "https://example.com",
  "strategy": "domain",
  "maxDepth": 3,
  "maxPages": 100,
  "concurrency": 5,
  "timeout": 10000
}
```

**Parameters**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `startUrl` | `string` | Yes | - | Starting URL for crawl |
| `strategy` | `'domain' \| 'all'` | No | `'domain'` | Crawl strategy |
| `maxDepth` | `number` | No | 3 | Maximum crawl depth |
| `maxPages` | `number` | No | 100 | Maximum pages to scrape |
| `concurrency` | `number` | No | 5 | Parallel requests |
| `timeout` | `number` | No | 10000 | Request timeout (ms) |

**Response**: `202 Accepted`

```json
{
  "jobId": "job_1707305448_abc123",
  "status": "pending",
  "message": "Crawl job created successfully"
}
```

---

### 5. Get Job Status

Check the current status of a crawl job.

**Endpoint**: `GET /api/crawl/:jobId`

**Response**: `200 OK`

**Status: Pending**
```json
{
  "jobId": "job_1707305448_abc123",
  "status": "pending",
  "createdAt": 1707305448000
}
```

**Status: Running**
```json
{
  "jobId": "job_1707305448_abc123",
  "status": "running",
  "createdAt": 1707305448000,
  "startedAt": 1707305450000,
  "metrics": {
    "pagesScraped": 45,
    "linksDiscovered": 234,
    "errors": 2,
    "currentDepth": 2,
    "elapsedTime": 5432
  }
}
```

**Status: Completed**
```json
{
  "jobId": "job_1707305448_abc123",
  "status": "completed",
  "createdAt": 1707305448000,
  "startedAt": 1707305450000,
  "completedAt": 1707305478000,
  "metrics": {
    "pagesScraped": 100,
    "linksDiscovered": 456,
    "errors": 5,
    "maxDepthReached": 3,
    "duration": 28000
  }
}
```

**Status: Failed**
```json
{
  "jobId": "job_1707305448_abc123",
  "status": "failed",
  "error": "Maximum retries exceeded",
  "createdAt": 1707305448000,
  "failedAt": 1707305460000
}
```

**Error Response**: `404 Not Found`

```json
{
  "error": "Job not found"
}
```

---

### 6. Get Job Result

Retrieve the complete result of a finished crawl job.

**Endpoint**: `GET /api/crawl/:jobId/result`

**Response**: `200 OK`

```json
{
  "jobId": "job_1707305448_abc123",
  "status": "completed",
  "startUrl": "https://example.com",
  "strategy": "domain",
  "metrics": {
    "pagesScraped": 100,
    "linksDiscovered": 456,
    "errors": 5,
    "maxDepthReached": 3,
    "duration": 28000
  },
  "pages": [
    {
      "url": "https://example.com",
      "title": "Example Domain",
      "text": "...",
      "links": ["..."],
      "depth": 0,
      "scrapedAt": 1707305450000
    },
    {
      "url": "https://example.com/about",
      "title": "About Us",
      "text": "...",
      "links": ["..."],
      "depth": 1,
      "scrapedAt": 1707305451000
    }
    // ... more pages
  ],
  "errors": [
    {
      "url": "https://example.com/broken-link",
      "error": "404 Not Found",
      "timestamp": 1707305455000
    }
  ]
}
```

**Error Responses**:

`404 Not Found` - Job doesn't exist
```json
{
  "error": "Job not found"
}
```

`409 Conflict` - Job not yet completed
```json
{
  "error": "Job is still running. Current status: running"
}
```

---

## Error Codes

| Status Code | Meaning | Common Causes |
|-------------|---------|---------------|
| `400` | Bad Request | Invalid parameters, malformed JSON |
| `404` | Not Found | Job ID doesn't exist |
| `409` | Conflict | Job not in expected state |
| `422` | Unprocessable Entity | Validation failed |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server-side error |
| `503` | Service Unavailable | System overloaded |

---

## Rate Limiting

**Default limits**:
- 100 requests per minute per IP
- 10 concurrent crawl jobs per IP

**Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1707305520
```

**Rate limit exceeded response**: `429 Too Many Requests`

```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 42
}
```

---

## Usage Examples

### cURL

**Single scrape**:
```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

**Start crawl**:
```bash
curl -X POST http://localhost:3000/api/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "startUrl": "https://example.com",
    "strategy": "domain",
    "maxDepth": 3,
    "maxPages": 100
  }'
```

**Check status**:
```bash
curl http://localhost:3000/api/crawl/job_1707305448_abc123
```

### JavaScript (fetch)

```javascript
// Start a crawl
const response = await fetch('http://localhost:3000/api/crawl', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    startUrl: 'https://example.com',
    strategy: 'domain',
    maxDepth: 3,
    maxPages: 100
  })
});

const { jobId } = await response.json();

// Poll for status
const checkStatus = async () => {
  const res = await fetch(`http://localhost:3000/api/crawl/${jobId}`);
  const job = await res.json();
  
  if (job.status === 'completed') {
    // Fetch result
    const resultRes = await fetch(`http://localhost:3000/api/crawl/${jobId}/result`);
    const result = await resultRes.json();
    console.log(result);
  } else if (job.status === 'running') {
    console.log('Progress:', job.metrics);
    setTimeout(checkStatus, 2000); // Poll every 2s
  }
};

checkStatus();
```

### Python (requests)

```python
import requests
import time

# Start crawl
response = requests.post('http://localhost:3000/api/crawl', json={
    'startUrl': 'https://example.com',
    'strategy': 'domain',
    'maxDepth': 3,
    'maxPages': 100
})

job_id = response.json()['jobId']

# Poll for completion
while True:
    status_res = requests.get(f'http://localhost:3000/api/crawl/{job_id}')
    job = status_res.json()
    
    if job['status'] == 'completed':
        result_res = requests.get(f'http://localhost:3000/api/crawl/{job_id}/result')
        result = result_res.json()
        print(result)
        break
    elif job['status'] == 'running':
        print(f"Progress: {job['metrics']['pagesScraped']} pages scraped")
        time.sleep(2)
    else:
        print(f"Job failed: {job.get('error')}")
        break
```

---

## WebSocket Support (Future)

Future versions will support WebSocket for real-time progress updates:

```javascript
const ws = new WebSocket('ws://localhost:3000/api/crawl/job_123/stream');

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Progress:', update.metrics);
};
```

---

## Pagination (Future)

For large result sets, pagination will be supported:

```
GET /api/crawl/:jobId/result?page=2&pageSize=50
```

---

**Next**: See [DEVELOPMENT.md](./DEVELOPMENT.md) for setup and development guide.
