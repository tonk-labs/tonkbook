import { DigestQuery, DigestResult, DigestItem, DailyDigest } from '../types/digest';
import { ragService } from './ragService';
import { v4 as uuidv4 } from 'uuid';

interface WebSearchResult {
  title: string;
  url: string;
  description: string;
  favicon?: string;
}

export class DigestService {
  /**
   * Generate a complete daily digest from a set of queries
   */
  async generateDailyDigest(
    queries: DigestQuery[],
    maxTotalItems: number = 25,
    enableAISummary: boolean = true
  ): Promise<DailyDigest> {
    const enabledQueries = queries.filter(q => q.enabled);
    const today = new Date().toISOString().split('T')[0];
    
    const digest: DailyDigest = {
      id: uuidv4(),
      date: today,
      results: [],
      totalItems: 0,
      generatedAt: new Date().toISOString(),
      status: "generating",
    };

    try {
      // Sort queries by priority (high -> medium -> low)
      const sortedQueries = this.sortQueriesByPriority(enabledQueries);
      
      let totalItemsCollected = 0;
      
      for (const query of sortedQueries) {
        if (totalItemsCollected >= maxTotalItems) {
          break;
        }
        
        const remainingItems = maxTotalItems - totalItemsCollected;
        const maxForThisQuery = Math.min(query.maxResults, remainingItems);
        
        try {
          const results = await this.processQuery(query, maxForThisQuery);
          digest.results.push(...results);
          totalItemsCollected += results.reduce((sum, r) => sum + r.items.length, 0);
        } catch (error) {
          console.error(`Failed to process query "${query.title}":`, error);
          // Continue with other queries even if one fails
        }
      }

      digest.totalItems = totalItemsCollected;

      // Generate AI summary if enabled
      if (enableAISummary && digest.results.length > 0) {
        try {
          digest.summary = await this.generateAISummary(digest.results);
        } catch (error) {
          console.error('Failed to generate AI summary:', error);
        }
      }

      digest.status = "completed";
    } catch (error) {
      console.error('Failed to generate daily digest:', error);
      digest.status = "failed";
    }

    return digest;
  }

  /**
   * Process a single query and return results
   */
  private async processQuery(query: DigestQuery, maxResults: number): Promise<DigestResult[]> {
    const results: DigestResult[] = [];

    if (query.sources === "web" || query.sources === "both") {
      try {
        const webResult = await this.performWebSearch(query, maxResults);
        if (webResult) {
          results.push(webResult);
        }
      } catch (error) {
        console.error(`Web search failed for query "${query.title}":`, error);
      }
    }

    if (query.sources === "rag" || query.sources === "both") {
      try {
        const ragResult = await this.performRAGSearch(query, maxResults);
        if (ragResult) {
          results.push(ragResult);
        }
      } catch (error) {
        console.error(`RAG search failed for query "${query.title}":`, error);
      }
    }

    return results;
  }

  /**
   * Perform web search using the existing WebSearchModal logic
   */
  private async performWebSearch(query: DigestQuery, maxResults: number): Promise<DigestResult | null> {
    try {
      const searchParams = new URLSearchParams({
        q: query.query,
        count: maxResults.toString(),
        offset: "0",
        safesearch: "moderate",
        search_lang: "en",
        country: "US",
        extra_snippets: "true",
      });

      const response = await fetch(
        `http://localhost:6080/api/brave-search/res/v1/web/search?${searchParams}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const results = await response.json();

      if (results.web?.results) {
        const items: DigestItem[] = results.web.results
          .slice(0, maxResults)
          .map((result: any) => ({
            title: result.title || "Untitled",
            content: result.description || result.snippet || "No description available",
            url: result.url,
            metadata: {
              source: "web" as const,
              sourceTitle: result.title,
              publishedAt: result.age,
              relevanceScore: result.rank ? (1 / result.rank) : undefined,
            },
          }));

        return {
          queryId: query.id,
          title: query.title,
          items,
          generatedAt: new Date().toISOString(),
          source: "web",
        };
      }
    } catch (error) {
      console.error("Web search error:", error);
    }

    return null;
  }

  /**
   * Perform RAG search using existing RAG service
   */
  private async performRAGSearch(query: DigestQuery, maxResults: number): Promise<DigestResult | null> {
    try {
      const ragResult = await ragService.queryRelevantSources(query.query, {
        maxTextResults: maxResults,
        maxCsvResults: Math.floor(maxResults / 2),
        includeText: true,
        includeCsv: true,
      });

      const items: DigestItem[] = [];

      // Add text sources
      ragResult.textSources.forEach((source) => {
        items.push({
          title: source.metadata.title,
          content: source.content,
          metadata: {
            source: "rag",
            sourceTitle: source.metadata.title,
            relevanceScore: source.score,
          },
        });
      });

      // Add CSV sources
      ragResult.csvSources.forEach((source) => {
        items.push({
          title: source.title,
          content: source.summary,
          metadata: {
            source: "rag",
            sourceTitle: source.title,
            relevanceScore: source.matchCount / 10, // Normalize match count to a score
          },
        });
      });

      if (items.length > 0) {
        return {
          queryId: query.id,
          title: query.title,
          items: items.slice(0, maxResults),
          generatedAt: new Date().toISOString(),
          source: "rag",
        };
      }
    } catch (error) {
      console.error("RAG search error:", error);
    }

    return null;
  }

  /**
   * Generate an AI summary of the digest results
   */
  private async generateAISummary(results: DigestResult[]): Promise<string> {
    const totalItems = results.reduce((sum, r) => sum + r.items.length, 0);
    
    // Build context from all results
    let context = `Daily Digest Summary Request\n\nTotal items collected: ${totalItems}\n\n`;
    
    results.forEach((result, index) => {
      context += `Query ${index + 1}: "${result.title}" (${result.items.length} items)\n`;
      result.items.forEach((item, itemIndex) => {
        context += `  ${itemIndex + 1}. ${item.title}\n     ${item.content.substring(0, 200)}...\n`;
      });
      context += '\n';
    });

    const messages = [
      {
        role: "system" as const,
        content: "You are an AI assistant that creates concise, insightful summaries of daily news digests. Focus on key themes, important developments, and notable trends across all the collected information."
      },
      {
        role: "user" as const,
        content: `${context}\n\nPlease provide a concise summary (2-3 paragraphs) highlighting the key themes and most important developments from today's digest. Focus on what someone should know to stay informed.`
      }
    ];

    try {
      const response = await fetch("http://localhost:5556/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages,
          model: "gpt-4o",
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI summary request failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result.content || "Summary generation failed.";
    } catch (error) {
      console.error("Failed to generate AI summary:", error);
      return "Summary generation unavailable.";
    }
  }

  /**
   * Sort queries by priority (high -> medium -> low)
   */
  private sortQueriesByPriority(queries: DigestQuery[]): DigestQuery[] {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return [...queries].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  /**
   * Test if web search service is available
   */
  async isWebSearchAvailable(): Promise<boolean> {
    try {
      const response = await fetch("http://localhost:6080/api/brave-search/health", {
        method: "GET",
        timeout: 5000,
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Test if RAG service is available
   */
  async isRAGAvailable(): Promise<boolean> {
    try {
      const stats = await ragService.getStats();
      return true;
    } catch {
      return false;
    }
  }
}

export const digestService = new DigestService();