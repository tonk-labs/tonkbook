import * as http from "http";
import dotenv from "dotenv";
import { BaseCredentialsManager } from "./utils/baseCredentialsManager";
import { LLMService, OpenAIProvider } from "./services/llmProvider";

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
console.log(`Starting AI worker at ${new Date().toISOString()}`);
console.log(`Node.js version: ${process.version}`);
console.log(`Platform: ${process.platform}`);

/**
 * Configuration for the worker
 */
interface WorkerConfig {
  port: number;
}

// Initialize credentials manager
const credentialsManager = new BaseCredentialsManager(
  [
    {
      name: "OpenAI API Key",
      filename: "creds/openai_api_key.txt",
      description: "OpenAI API key for accessing GPT models",
      instructions:
        "Get your API key from https://platform.openai.com/api-keys",
      validationFn: (content) => {
        const trimmed = content.trim();
        return {
          valid: trimmed.startsWith("sk-") && trimmed.length > 20,
          message: "Must be a valid OpenAI API key starting with 'sk-'",
        };
      },
      header: "Authorization",
    },
  ],
  process.cwd(),
);

// Initialize LLM service
const llmService = new LLMService();

/**
 * Start the worker with the given configuration
 */
export async function startWorker(config: WorkerConfig): Promise<http.Server> {
  const { port } = config;

  // Helper function to handle CORS
  const setCorsHeaders = (res: http.ServerResponse) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  };

  // Initialize credentials and LLM service
  await credentialsManager.init();
  const { complete } = credentialsManager.checkCredentials();

  if (complete) {
    const openaiKey = credentialsManager.getCredentialByName("OpenAI API Key");
    if (openaiKey) {
      const openaiProvider = new OpenAIProvider(openaiKey);
      llmService.addProvider(openaiProvider);
      console.log("✅ OpenAI provider configured");
    }
  } else {
    console.log(
      "⚠️  OpenAI credentials not found. Use 'npx tsx dist/cli.js setup' to configure.",
    );
  }

  // Helper function to parse JSON body
  const parseJsonBody = (req: http.IncomingMessage): Promise<any> => {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error("Invalid JSON"));
        }
      });
    });
  };

  // Create HTTP server
  const server = http.createServer(async (req, res) => {
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

    // API routes for LLM functionality
    if (req.url?.startsWith("/api/")) {
      try {
        // Get available providers
        if (req.method === "GET" && req.url === "/api/providers") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              providers: llmService.getAvailableProviders(),
            }),
          );
          return;
        }

        // Chat completion endpoint
        if (req.method === "POST" && req.url === "/api/chat") {
          const data = await parseJsonBody(req);

          if (!data.messages || !Array.isArray(data.messages)) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "messages array is required" }));
            return;
          }

          // Handle streaming
          if (data.stream) {
            res.writeHead(200, {
              "Content-Type": "text/plain",
              "Transfer-Encoding": "chunked",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive"
            });

            try {
              for await (const chunk of llmService.stream({
                messages: data.messages,
                model: data.model,
                temperature: data.temperature,
                max_tokens: data.max_tokens
              }, data.provider)) {
                res.write(chunk);
              }
              res.end();
            } catch (error) {
              res.write(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`);
              res.end();
            }
            return;
          }

          // Non-streaming response
          const response = await llmService.complete(
            {
              messages: data.messages,
              model: data.model,
              temperature: data.temperature,
              max_tokens: data.max_tokens,
            },
            data.provider,
          );

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(response));
          return;
        }

        // Simple completion endpoint
        if (req.method === "POST" && req.url === "/api/complete") {
          const data = await parseJsonBody(req);

          if (!data.prompt) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "prompt is required" }));
            return;
          }

          const messages = data.system
            ? [
                { role: "system" as const, content: data.system },
                { role: "user" as const, content: data.prompt },
              ]
            : [{ role: "user" as const, content: data.prompt }];

          // Handle streaming
          if (data.stream) {
            res.writeHead(200, {
              "Content-Type": "text/plain",
              "Transfer-Encoding": "chunked",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive"
            });

            try {
              for await (const chunk of llmService.stream({
                messages,
                model: data.model,
                temperature: data.temperature,
                max_tokens: data.max_tokens
              }, data.provider)) {
                res.write(chunk);
              }
              res.end();
            } catch (error) {
              res.write(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`);
              res.end();
            }
            return;
          }

          // Non-streaming response
          const response = await llmService.complete(
            {
              messages,
              model: data.model,
              temperature: data.temperature,
              max_tokens: data.max_tokens,
            },
            data.provider,
          );

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(response));
          return;
        }

        // API route not found
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "API endpoint not found" }));
        return;
      } catch (error) {
        console.error("API Error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error:
              error instanceof Error ? error.message : "Internal server error",
          }),
        );
        return;
      }
    }

    // Main worker endpoint
    if (req.method === "POST" && req.url === "/tonk") {
      try {
        const data = await parseJsonBody(req);

        // Process the request data
        console.log("Received data:", data);

        // Send success response
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            message: "Request processed successfully",
          }),
        );
      } catch (error) {
        console.error("Error processing request:", error);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ success: false, error: "Invalid data format" }),
        );
      }
    } else {
      // Handle other routes
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Not found" }));
    }
  });

  // Start the server
  return new Promise((resolve) => {
    server.listen(port, async () => {
      console.log(`ai worker listening on http://localhost:${port}`);
      console.log(`API endpoints available at http://localhost:${port}/api/`);

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
