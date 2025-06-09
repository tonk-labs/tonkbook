# Web Scraper Worker

A web scraping worker that extracts content from websites and stores it in `keepsync`. This worker can handle both static HTML and JavaScript-heavy sites, intelligently extracting main content while filtering out navigation, ads, and other noise.

## Features

- **Intelligent Content Extraction**: Automatically identifies and extracts main content from web pages
- **JavaScript Support**: Uses Playwright for JavaScript-heavy sites and SPAs
- **Content Processing**: Converts HTML to clean markdown format
- **Metadata Extraction**: Captures title, description, author, keywords, and other meta information
- **Flexible Storage**: Stores content in user-configured `keepsync` paths with auto-generated paths as fallback
- **Image Handling**: Optional image extraction and absolute URL conversion
- **Error Handling**: Robust error handling with detailed error messages

## Usage

### Starting the Worker

```bash
# Development mode with hot reload
pnpm dev

# Production mode
pnpm build
pnpm start
```

The worker runs on port 5555 by default (configurable via `WORKER_PORT` environment variable).

### API Endpoints

#### POST /tonk - Scrape Website

Scrapes a website and stores the content in KeepSync.

**Request Body:**
```json
{
  "url": "https://example.com",
  "outputPath": "scraped/example-com/article",  // optional
  "options": {  // optional
    "useJavaScript": false,
    "timeout": 30000,
    "userAgent": "Custom Bot 1.0",
    "waitForSelector": ".main-content",
    "extractImages": false,
    "followRedirects": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://example.com",
  "outputPath": "scraped/example-com/article",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "content": {
    "url": "https://example.com",
    "title": "Example Page Title",
    "content": "<html>...",
    "markdown": "# Example Page Title\n\nContent...",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "metadata": {
      "description": "Page description",
      "keywords": "example, demo",
      "author": "Author Name",
      "canonical": "https://example.com",
      "language": "en",
      "wordCount": 245,
      "characterCount": 1523
    }
  }
}
```

#### GET /content/{path} - Retrieve Scraped Content

Retrieves previously scraped content from KeepSync.

**Example:**
```bash
curl -X GET "http://localhost:5555/content/scraped/example-com/article"
```

#### GET /health - Health Check

Returns worker status.

**Response:**
```json
{
  "status": "ok"
}
```

### Scraping Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `useJavaScript` | boolean | false | Use Playwright for JavaScript-heavy sites |
| `timeout` | number | 30000 | Request timeout in milliseconds |
| `userAgent` | string | Chrome UA | Custom User-Agent string |
| `waitForSelector` | string | - | CSS selector to wait for (JS mode only) |
| `extractImages` | boolean | false | Extract and convert image URLs |
| `followRedirects` | boolean | true | Follow HTTP redirects |

### Path Generation

If no `outputPath` is provided, the worker automatically generates one based on the URL:

- `https://example.com/article` → `scraped/example.com/article/2024-01-15`
- `https://news.ycombinator.com` → `scraped/news.ycombinator.com/2024-01-15`

## Examples

### Basic Website Scraping

```bash
curl -X POST http://localhost:5555/tonk \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com"
  }'
```

### JavaScript-Heavy Site

```bash
curl -X POST http://localhost:5555/tonk \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://spa-example.com",
    "options": {
      "useJavaScript": true,
      "waitForSelector": ".content-loaded",
      "timeout": 15000
    }
  }'
```

### Custom Path and Options

```bash
curl -X POST http://localhost:5555/tonk \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://blog.example.com/article",
    "outputPath": "articles/blog/my-article",
    "options": {
      "extractImages": true,
      "userAgent": "MyBot 1.0"
    }
  }'
```

### Retrieve Scraped Content

```bash
curl -X GET "http://localhost:5555/content/articles/blog/my-article"
```

## Content Processing

The worker performs intelligent content extraction:

1. **Content Identification**: Looks for main content areas using semantic selectors (`main`, `article`, `[role="main"]`, etc.)
2. **Noise Removal**: Removes navigation, headers, footers, ads, and scripts
3. **Title Extraction**: Finds page title from multiple sources (H1, title tag, meta tags)
4. **Metadata Extraction**: Captures description, keywords, author, canonical URL, and language
5. **Markdown Conversion**: Converts HTML to clean, readable markdown
6. **Statistics**: Counts words and characters in the final content

## Data Schema

Content is stored in `keepsync` with the following schema:

```json
{
  "type": "scraped-content",
  "url": "string",
  "title": "string", 
  "content": "string",
  "markdown": "string",
  "scrapedAt": "ISO date",
  "lastUpdated": "ISO date",
  "metadata": {
    "description": "string",
    "keywords": "string", 
    "author": "string",
    "canonical": "string",
    "language": "string",
    "wordCount": "number",
    "characterCount": "number"
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKER_PORT` | 5555 | HTTP server port |
| `SYNC_WS_URL` | ws://localhost:7777/sync | KeepSync WebSocket URL |
| `SYNC_URL` | http://localhost:7777 | KeepSync HTTP URL |
| `NODE_ENV` | development | Runtime environment |

## Error Handling

The worker includes comprehensive error handling:

- **Network Errors**: Timeout, connection failures, DNS issues
- **Content Errors**: Empty pages, parsing failures, invalid HTML
- **Storage Errors**: `keepsync` connection issues, write failures
- **Validation Errors**: Missing URL, invalid options

All errors are logged and returned in a structured format:

```json
{
  "success": false,
  "url": "https://example.com",
  "outputPath": "scraped/example.com/2024-01-15",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "error": "Failed to scrape https://example.com: timeout"
}
```

## Development

### Building

```bash
pnpm build
```

### Running Tests

```bash
pnpm test
```

### Development Mode

```bash
pnpm dev
```

## Configuration

The worker is configured via `worker.config.js`:

- **Runtime**: Port, health checks, intervals
- **Process**: Instances, auto-restart, memory limits  
- **Schemas**: Data validation for `keepsync` documents

## Integration with Tonk Workspace

This worker integrates with the Tonk workspace ecosystem:

- **Data Flow**: Scraped content flows into `keepsync` for use by other workers and views
- **Views**: Create React apps to visualize and browse scraped content
- **Workers**: Chain with other workers for content analysis, summarization, etc.
- **Automation**: Use with file listeners to automatically scrape URLs from documents

## Troubleshooting

### Common Issues

- **Timeout Errors**: Increase timeout for slow sites or use JavaScript mode
- **Empty Content**: Site may require JavaScript rendering
- **403/429 Errors**: Check user agent, add delays, respect rate limits
- **`keepsync` Errors**: Verify Tonk server is running and accessible (run `tonk hello` on local machine)

### Debugging

Enable debug logging by setting `NODE_ENV=development` and check console output for detailed error messages and processing steps.

## License

MIT © Tonk Labs
