import { configureSyncEngine } from "@tonk/keepsync";
import { NetworkAdapterInterface } from "@automerge/automerge-repo";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import * as http from "http";
import dotenv from "dotenv";
import { WebScraper } from "./utils/webScraper";
import {
  KeepsyncStorage,
  ScrapeRequest,
  ScrapeResult,
} from "./utils/keepsyncStorage";

// Load environment variables
dotenv.config();

// Set up global error handlers
process.on("uncaughtException", (err) => {
  console.error(`Uncaught exception: ${err.message}`);
  console.error(err.stack);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise);
  console.error("Reason:", reason);
});

// Log startup information
console.log(`Starting web-scraper worker at ${new Date().toISOString()}`);
console.log(`Node.js version: ${process.version}`);
console.log(`Platform: ${process.platform}`);

/**
 * Configuration for the worker
 */
interface WorkerConfig {
  port: number;
}

/**
 * Start the worker with the given configuration
 */
export async function startWorker(config: WorkerConfig): Promise<http.Server> {
  const { port } = config;

  // Configure sync engine
  const SYNC_WS_URL = process.env.SYNC_WS_URL || "ws://localhost:7777/sync";
  const SYNC_URL = process.env.SYNC_URL || "http://localhost:7777";

  const wsAdapter = new BrowserWebSocketClientAdapter(SYNC_WS_URL);
  const engine = configureSyncEngine({
    url: SYNC_URL,
    network: [wsAdapter as any as NetworkAdapterInterface],
    storage: new NodeFSStorageAdapter(),
  });

  // Initialize scraper and storage
  const webScraper = new WebScraper();
  const keepsyncStorage = new KeepsyncStorage();

  // Helper function to handle CORS
  const setCorsHeaders = (res: http.ServerResponse) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  };

  // Create HTTP server
  const server = http.createServer((req, res) => {
    // Set CORS headers for all responses
    setCorsHeaders(res);

    // Handle preflight OPTIONS requests
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Example endpoint
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // Get scraped content endpoint
    if (req.method === "GET" && req.url?.startsWith("/content/")) {
      const handleGetContent = async () => {
        try {
          const path = decodeURIComponent(req.url!.slice(9)); // Remove "/content/"
          const content = await keepsyncStorage.getScrapedContent(path);

          if (!content) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({ success: false, error: "Content not found" }),
            );
            return;
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, content }));
        } catch (error) {
          console.error("Error retrieving content:", error);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      };

      handleGetContent();
      return;
    }

    // Main scraping endpoint
    if (req.method === "POST" && req.url === "/tonk") {
      let body = "";

      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          const scrapeRequest: ScrapeRequest = JSON.parse(body);

          // Validate request
          if (!scrapeRequest.url) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                success: false,
                error: "URL is required",
              }),
            );
            return;
          }

          console.log(`Scraping ${scrapeRequest.url}...`);

          // Generate output path if not provided
          const outputPath =
            scrapeRequest.outputPath ||
            keepsyncStorage.generatePathFromUrl(scrapeRequest.url);

          console.log(`Will store content at: ${outputPath}`);

          // Scrape the content
          const scrapedContent = await webScraper.scrape(
            scrapeRequest.url,
            scrapeRequest.options || {},
          );

          // Store in keepsync
          await keepsyncStorage.storeScrapedContent(scrapedContent, outputPath);

          const result: ScrapeResult = {
            success: true,
            url: scrapeRequest.url,
            outputPath,
            timestamp: new Date().toISOString(),
            content: scrapedContent,
          };

          console.log(`Successfully scraped and stored ${scrapeRequest.url}`);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (error) {
          console.error("Error processing scrape request:", error);

          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const result: ScrapeResult = {
            success: false,
            url: body ? JSON.parse(body).url || "unknown" : "unknown",
            outputPath: body
              ? JSON.parse(body).outputPath || "unknown"
              : "unknown",
            timestamp: new Date().toISOString(),
            error: errorMessage,
          };

          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        }
      });
    } else {
      // Handle other routes
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Not found" }));
    }
  });

  // Start the server
  return new Promise((resolve) => {
    server.listen(port, async () => {
      console.log(
        `web-scraper worker listening on http://localhost:${port}/tonk`,
      );

      // Initialize the sync engine
      try {
        await engine.whenReady();
        console.log("Keepsync engine is ready");
      } catch (error) {
        console.error("Error initializing sync engine:", error);
      }

      // Handle graceful shutdown
      const cleanup = () => {
        console.log("Shutting down...");
        process.exit(0);
      };

      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);

      resolve(server);
    });
  });
}

// If this file is run directly, start the worker
if (require.main === module) {
  const port = process.env.WORKER_PORT
    ? parseInt(process.env.WORKER_PORT, 10)
    : 5555;
  startWorker({ port })
    .then(() => console.log(`Worker started on port ${port}`))
    .catch((err) => console.error("Failed to start worker:", err));
}
