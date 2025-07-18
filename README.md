# TonkBook

TonkBook is a highly-extensible LLM-assisted research platform. Create notes, chat with AI about your sources, and vibe code powerful interfaces over your intelligence.

## Prerequisites

Install the Tonk CLI globally:

```bash
npm i -g @tonk/cli
```

## Quick Start

1. **Install dependencies:**
   ```bash
   cd tonkbook
   pnpm install
   ```

2. **Start the main application:**
   ```bash
   pnpm dev
   ```
   This starts the web interface at `http://localhost:3000`

3. **Start the AI worker** (required for chat functionality):
   ```bash
   cd workers/ai
   pnpm install
   pnpm build
   tonk worker register
   tonk worker start ai
   ```
   The AI worker runs on `http://localhost:5556`

4. **Start the web scraper worker** (optional, for web search sources):
   ```bash
   cd workers/web-scraper  
   pnpm install
   pnpm build
   tonk worker register
   tonk worker start web-scraper
   ```
   The AI worker runs on `http://localhost:5555`

## Configuration

### AI Worker Setup

The AI worker requires an OpenAI API key:
```bash
cd workers/ai
pnpm auth
```

### Brave Search API Setup

For web search functionality in sources, you'll need a Brave Search API key:

1. Get a Brave Search API key from [Brave Search API](https://brave.com/search/api/)
2. Set the environment variable:
   ```bash
   export BRAVE_SEARCH_API_KEY=your_api_key_here
   ```
   
   Or add it to your `.env` file:
   ```
   BRAVE_SEARCH_API_KEY=your_api_key_here
   ```

TonkBook will use this key to authenticate requests to the Brave Search API.

## Architecture

TonkBook uses a modular architecture:
- **Frontend**: React app with Tailwind CSS
- **AI Worker**: Handles LLM interactions and document indexing with ChromaDB
- **Web Scraper**: Extracts content from web searches
- **Keepsync**: Real-time data synchronization between components

## Building for Production

```bash
pnpm build
```

This will build the frontend application and export the API configuration for production.

## Deployment Options

### 1. Deploy to Tonk Server

You can deploy your app to a running Tonk server using the Tonk CLI:

```bash
tonk push
```

This will:
1. Build your application
2. Upload the bundle to your Tonk server

To start an uploaded Tonk app:

```bash
tonk start <bundleName>
```

### 2. Docker Deployment

This application comes with Docker support for easy self-hosting using the Tonk server.

#### Prerequisites

- Docker and Docker Compose installed on your system

#### Running with Docker Compose

```bash
# Build your application first
pnpm build

# Start the Tonk server container with your app
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

The Docker setup:
- Uses the official Tonk server container
- Automatically deploys your built application as a bundle
- Starts your application on port 8000

#### Environment Variables

Edit the `docker-compose.yml` file to add any required API keys or environment variables for your services.

#### Volumes

The Docker setup creates two persistent volumes:
- `tonk-data`: Stores the Tonk server's data
- `tonk-bundles`: Stores application bundles

#### Custom Docker Configuration

You can customize the Docker setup by editing the `docker-compose.yml` file.
