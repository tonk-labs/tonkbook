import { readDoc, writeDoc } from "@tonk/keepsync";
import { ScrapedContent } from "./webScraper";

export interface ScrapeRequest {
  url: string;
  outputPath: string;
  options?: {
    useJavaScript?: boolean;
    timeout?: number;
    userAgent?: string;
    waitForSelector?: string;
    extractImages?: boolean;
    followRedirects?: boolean;
  };
}

export interface ScrapeResult {
  success: boolean;
  url: string;
  outputPath: string;
  timestamp: string;
  error?: string;
  content?: ScrapedContent;
}

export class KeepsyncStorage {
  async storeScrapedContent(
    content: ScrapedContent,
    outputPath: string,
  ): Promise<void> {
    try {
      // Ensure the path is properly formatted
      const normalizedPath = this.normalizePath(outputPath);

      // Read existing document or create new one
      let existingDoc: any = {};
      try {
        existingDoc = (await readDoc(normalizedPath)) || {};
      } catch (error) {
        // Document doesn't exist yet, that's fine
        console.log(`Creating new document at ${normalizedPath}`);
      }

      // Create the document structure
      const document = {
        ...existingDoc,
        type: "scraped-content",
        url: content.url,
        title: content.title,
        content: content.content,
        markdown: content.markdown,
        scrapedAt: content.timestamp,
        lastUpdated: new Date().toISOString(),
        metadata: content.metadata,
      };

      // Write to keepsync
      await writeDoc(normalizedPath, document);
      console.log(`Scraped content stored at ${normalizedPath}`);
    } catch (error) {
      throw new Error(
        `Failed to store content in keepsync: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getScrapedContent(path: string): Promise<ScrapedContent | null> {
    try {
      const normalizedPath = this.normalizePath(path);
      const doc = (await readDoc(normalizedPath)) as any;

      if (!doc || doc.type !== "scraped-content") {
        return null;
      }

      return {
        url: doc.url,
        title: doc.title,
        content: doc.content,
        markdown: doc.markdown,
        timestamp: doc.scrapedAt,
        metadata: doc.metadata,
      };
    } catch (error) {
      console.error(`Failed to read content from ${path}:`, error);
      return null;
    }
  }

  async listScrapedContent(basePath: string = ""): Promise<string[]> {
    try {
      // This would need to be implemented based on keepsync's directory listing capabilities
      // For now, return empty array as keepsync might not have built-in directory listing
      return [];
    } catch (error) {
      console.error(`Failed to list content at ${basePath}:`, error);
      return [];
    }
  }

  async deleteScrapedContent(path: string): Promise<boolean> {
    try {
      const normalizedPath = this.normalizePath(path);
      // Note: keepsync might not have a delete operation, so we might need to write null/empty
      await writeDoc(normalizedPath, null);
      return true;
    } catch (error) {
      console.error(`Failed to delete content at ${path}:`, error);
      return false;
    }
  }

  private normalizePath(path: string): string {
    // Ensure path doesn't start with slash and uses forward slashes
    let normalized = path.replace(/^\/+/, "").replace(/\\/g, "/");

    // If path doesn't end with a meaningful name, add default
    if (normalized.endsWith("/")) {
      normalized += "scraped-content";
    }

    return normalized;
  }

  generatePathFromUrl(url: string, basePath: string = "scraped"): string {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace(/^www\./, "");
      const pathPart = urlObj.pathname
        .replace(/[^a-zA-Z0-9\-_/]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .replace(/\/$/, "");

      const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      let generatedPath = `${basePath}/${domain}`;
      if (pathPart && pathPart !== "/") {
        generatedPath += `/${pathPart}`;
      }
      generatedPath += `/${timestamp}`;

      return generatedPath;
    } catch (error) {
      // Fallback for invalid URLs
      const sanitized = url
        .replace(/[^a-zA-Z0-9\-_]/g, "-")
        .replace(/-+/g, "-");
      const timestamp = new Date().toISOString().slice(0, 10);
      return `${basePath}/unknown/${sanitized}/${timestamp}`;
    }
  }
}

