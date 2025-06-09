import axios from "axios";
import * as cheerio from "cheerio";
import { chromium } from "playwright";
import TurndownService from "turndown";

export interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  markdown: string;
  timestamp: string;
  metadata: {
    description?: string;
    keywords?: string;
    author?: string;
    canonical?: string;
    language?: string;
    wordCount: number;
    characterCount: number;
  };
}

export interface ScrapeOptions {
  useJavaScript?: boolean;
  timeout?: number;
  userAgent?: string;
  waitForSelector?: string;
  extractImages?: boolean;
  followRedirects?: boolean;
}

export class WebScraper {
  private turndownService: TurndownService;

  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
      emDelimiter: "*",
    });

    // Configure turndown rules
    this.turndownService.addRule("removeScript", {
      filter: ["script", "style", "noscript"],
      replacement: () => "",
    });
  }

  async scrape(
    url: string,
    options: ScrapeOptions = {},
  ): Promise<ScrapedContent> {
    const {
      useJavaScript = false,
      timeout = 30000,
      userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      waitForSelector,
      extractImages = false,
      followRedirects = true,
    } = options;

    try {
      let html: string;
      let finalUrl = url;

      if (useJavaScript) {
        // Use Playwright for JavaScript-heavy sites
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage({
          userAgent,
        });

        await page.setViewportSize({ width: 1280, height: 720 });

        const response = await page.goto(url, {
          waitUntil: "networkidle",
          timeout,
        });

        if (!response) {
          throw new Error("Failed to load page");
        }

        finalUrl = page.url();

        if (waitForSelector) {
          await page.waitForSelector(waitForSelector, { timeout: 10000 });
        }

        html = await page.content();
        await browser.close();
      } else {
        // Use axios for simple HTML scraping
        const response = await axios.get(url, {
          timeout,
          headers: {
            "User-Agent": userAgent,
          },
          maxRedirects: followRedirects ? 5 : 0,
          validateStatus: (status) => status < 400,
        });

        html = response.data;
        finalUrl = response.request.res.responseUrl || url;
      }

      return this.parseHtml(html, finalUrl, extractImages);
    } catch (error) {
      throw new Error(
        `Failed to scrape ${url}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private parseHtml(
    html: string,
    url: string,
    extractImages: boolean,
  ): ScrapedContent {
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $("script, style, noscript, iframe, embed, object").remove();
    $(
      "nav, header, footer, aside, .advertisement, .ads, .social-share",
    ).remove();

    // Extract title
    const title = this.extractTitle($);

    // Extract main content
    const content = this.extractMainContent($);

    // Extract metadata
    const metadata = this.extractMetadata($);

    // Convert to markdown
    let markdown = this.turndownService.turndown(content);

    // Process images if requested
    if (extractImages) {
      markdown = this.processImages($, markdown, url);
    }

    // Calculate word and character counts
    const plainText = this.stripMarkdown(markdown);
    metadata.wordCount = this.countWords(plainText);
    metadata.characterCount = plainText.length;

    return {
      url,
      title,
      content,
      markdown,
      timestamp: new Date().toISOString(),
      metadata,
    };
  }

  private extractTitle($: cheerio.CheerioAPI): string {
    // Try multiple selectors for title
    const titleSelectors = [
      "h1",
      "title",
      '[property="og:title"]',
      '[name="twitter:title"]',
      ".title",
      ".headline",
      "article h1",
    ];

    for (const selector of titleSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        const title = element.attr("content") || element.text().trim();
        if (title && title.length > 0) {
          return title;
        }
      }
    }

    return "Untitled";
  }

  private extractMainContent($: cheerio.CheerioAPI): string {
    // Try to find main content area
    const contentSelectors = [
      "main",
      "article",
      '[role="main"]',
      ".content",
      ".post-content",
      ".entry-content",
      ".article-content",
      "#content",
      ".main-content",
    ];

    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length > 0 && element.text().trim().length > 100) {
        return element.html() || "";
      }
    }

    // Fallback: try to extract from body, removing common non-content elements
    const body = $("body").clone();
    body
      .find("nav, header, footer, aside, .sidebar, .menu, .navigation")
      .remove();

    return body.html() || "";
  }

  private extractMetadata($: cheerio.CheerioAPI): ScrapedContent["metadata"] {
    const metadata: ScrapedContent["metadata"] = {
      wordCount: 0,
      characterCount: 0,
    };

    // Description
    metadata.description =
      $('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="twitter:description"]').attr("content") ||
      undefined;

    // Keywords
    metadata.keywords = $('meta[name="keywords"]').attr("content") || undefined;

    // Author
    metadata.author =
      $('meta[name="author"]').attr("content") ||
      $('meta[property="article:author"]').attr("content") ||
      $('[rel="author"]').text().trim() ||
      undefined;

    // Canonical URL
    metadata.canonical = $('link[rel="canonical"]').attr("href") || undefined;

    // Language
    metadata.language =
      $("html").attr("lang") ||
      $('meta[http-equiv="content-language"]').attr("content") ||
      undefined;

    return metadata;
  }

  private processImages(
    $: cheerio.CheerioAPI,
    markdown: string,
    baseUrl: string,
  ): string {
    $("img").each((_, img) => {
      const src = $(img).attr("src");
      const alt = $(img).attr("alt") || "";

      if (src) {
        // Convert relative URLs to absolute
        const absoluteUrl = new URL(src, baseUrl).href;
        // Add image reference to markdown
        markdown += `\n\n![${alt}](${absoluteUrl})`;
      }
    });

    return markdown;
  }

  private stripMarkdown(markdown: string): string {
    return markdown
      .replace(/[#*_`~\[\]()]/g, "")
      .replace(/!\[.*?\]\(.*?\)/g, "")
      .replace(/\[.*?\]\(.*?\)/g, "")
      .replace(/\n+/g, " ")
      .trim();
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  }
}

