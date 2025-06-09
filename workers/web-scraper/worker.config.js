/**
 * Tonk Worker Configuration
 */
module.exports = {
  // Runtime configuration
  runtime: {
    port: 5555,
    healthCheck: {
      endpoint: '/health',
      method: 'GET',
      interval: 30000,
      timeout: 5000,
    },
  },

  // Process management
  process: {
    file: "cli.js",
    args: "start",
    cwd: "./dist",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
    },
  },

  // CLI configuration
  cli: {
    script: './dist/cli.js',
    command: 'start',
    args: ['--port', '5555'],
  },

  // Data schema
  // This section defines the schemas for data stored in keepsync
  // Can be used to validate data before storing it
  schemas: {
    // Define schemas for different document types
    documents: {
      // Main document schema
      default: {},

      // Scraped content schema
      'scraped-content': {
        type: "object",
        properties: {
          type: { type: "string", const: "scraped-content" },
          url: { type: "string", format: "uri" },
          title: { type: "string" },
          content: { type: "string" },
          markdown: { type: "string" },
          scrapedAt: { type: "string", format: "date-time" },
          lastUpdated: { type: "string", format: "date-time" },
          metadata: {
            type: "object",
            properties: {
              description: { type: "string" },
              keywords: { type: "string" },
              author: { type: "string" },
              canonical: { type: "string", format: "uri" },
              language: { type: "string" },
              wordCount: { type: "number", minimum: 0 },
              characterCount: { type: "number", minimum: 0 }
            },
            required: ["wordCount", "characterCount"]
          }
        },
        required: ["type", "url", "title", "content", "markdown", "scrapedAt", "metadata"]
      }
    },
  },

  // Additional configuration
  config: {},
};
