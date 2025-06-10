import { vectorService } from "./vectorService";
import { csvQueryService } from "./csvQueryService";
import { Source } from "../types/source";

interface RAGResult {
  textSources: {
    content: string;
    metadata: {
      sourceId: string;
      sourceType: Source["metadata"]["type"];
      chunkIndex: number;
      title: string;
    };
    score: number;
  }[];
  csvSources: {
    sourceId: string;
    title: string;
    summary: string;
    matchCount: number;
  }[];
  combinedContext: string;
}

interface QueryOptions {
  maxTextResults?: number;
  maxCsvResults?: number;
  includeText?: boolean;
  includeCsv?: boolean;
  csvQuery?: string; // Override CSV query if different from main query
}

export class RAGService {
  /**
   * Query all sources and return relevant context for LLM
   */
  async queryRelevantSources(
    query: string,
    options: QueryOptions = {},
  ): Promise<RAGResult> {
    const {
      maxTextResults = 5,
      maxCsvResults = 3,
      includeText = true,
      includeCsv = true,
      csvQuery = query,
    } = options;

    // For now, we'll query the AI worker's vector service via API
    // This will be expanded to include CSV queries as well
    const textResults = includeText
      ? await this.queryAIWorkerVectorSearch(query, maxTextResults)
      : [];

    const csvResults = includeCsv
      ? csvQueryService.smartQuery(csvQuery, maxCsvResults)
      : [];

    const csvSources = csvResults.map((result: any) => ({
      sourceId: result.sourceId,
      title: result.title,
      summary: this.formatCsvSummary(result),
      matchCount: result.matchCount,
    }));

    const combinedContext = this.buildCombinedContext(textResults, csvSources);

    return {
      textSources: textResults,
      csvSources,
      combinedContext,
    };
  }

  /**
   * Query vector search via AI worker
   */
  private async queryAIWorkerVectorSearch(
    query: string,
    maxResults: number,
  ): Promise<any[]> {
    try {
      const response = await fetch("http://localhost:5556/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          maxResults,
        }),
      });

      if (!response.ok) {
        console.warn("Vector search via AI worker failed, using empty results");
        return [];
      }

      const result = await response.json();
      return result.results || [];
    } catch (error) {
      console.error("Failed to query AI worker vector search:", error);
      return [];
    }
  }

  /**
   * Add a source to the appropriate storage system
   */
  async addSource(source: Source, content: string): Promise<void> {
    console.log(
      `RAG Service: Adding source ${source.id} of type ${source.metadata.type}`,
    );
    switch (source.metadata.type) {
      case "text":
      case "pdf":
      case "web":
        console.log(`RAG Service: Adding to vector service`);
        await vectorService.addDocument(source, content);
        console.log(`RAG Service: Successfully added to vector service`);
        break;
      case "csv":
        console.log(`RAG Service: Adding to CSV service`);
        await csvQueryService.addCSVSource(source, content);
        console.log(`RAG Service: Successfully added to CSV service`);
        break;
    }
  }

  /**
   * Remove a source from storage
   */
  async removeSource(source: Source): Promise<void> {
    switch (source.metadata.type) {
      case "text":
      case "pdf":
      case "web":
        await vectorService.removeDocument(source.id);
        break;
      case "csv":
        csvQueryService.removeCSVSource(source.id);
        break;
    }
  }

  /**
   * Update a source in storage
   */
  async updateSource(source: Source, content: string): Promise<void> {
    await this.removeSource(source);
    await this.addSource(source, content);
  }

  /**
   * Generate an AI response using RAG context with streaming
   */
  async *generateStreamingResponse(
    query: string,
    noteContext?: string,
    options?: QueryOptions,
  ): AsyncGenerator<string, RAGResult, unknown> {
    const ragResult = await this.queryRelevantSources(query, options);

    const systemPrompt = this.buildSystemPrompt(ragResult, noteContext);
    const messages = this.buildChatMessages(query, ragResult, systemPrompt);

    try {
      for await (const chunk of this.streamAIWorkerChat(messages)) {
        yield chunk;
      }
    } catch (error) {
      console.error("Failed to stream AI response:", error);
      yield "Sorry, I encountered an error while generating the response.";
    }

    return ragResult;
  }

  /**
   * Generate an AI response using RAG context (non-streaming fallback)
   */
  async generateResponse(
    query: string,
    noteContext?: string,
    options?: QueryOptions,
  ): Promise<{ response: string; sources: RAGResult }> {
    const ragResult = await this.queryRelevantSources(query, options);

    const systemPrompt = this.buildSystemPrompt(ragResult, noteContext);
    const messages = this.buildChatMessages(query, ragResult, systemPrompt);

    const aiResponse = await this.callAIWorkerChat(messages);

    return {
      response: aiResponse,
      sources: ragResult,
    };
  }

  /**
   * Build system prompt with RAG context
   */
  private buildSystemPrompt(
    ragResult: RAGResult,
    noteContext?: string,
  ): string {
    let prompt = `You are a knowledgeable research assistant with access to relevant information from various sources. Your role is to provide thoughtful, analytical, and comprehensive responses that synthesize information across sources.

AVAILABLE CONTEXT:
${ragResult.combinedContext}`;

    if (noteContext) {
      prompt += `\n\nCURRENT NOTE CONTEXT:
${noteContext}`;
    }

    prompt += `\n\nResponse Guidelines:
- Provide analytical, long-form responses that explore the topic in depth
- Synthesize information across multiple sources when possible
- Always cite your sources using format like "(Source: [Title])" when referencing specific information
- Include concrete details, data points, and examples from the sources
- Offer nuanced perspectives and consider multiple viewpoints
- Draw connections between different pieces of information
- If information is limited or missing, acknowledge this while still providing what insights you can
- Structure responses with clear reasoning and logical flow
- Aim for substantive, thoughtful analysis rather than brief answers`;

    return prompt;
  }

  /**
   * Build chat messages for the conversation
   */
  private buildChatMessages(query: string, ragResult: RAGResult, systemPrompt: string) {
    const sourceCount =
      ragResult.textSources.length + ragResult.csvSources.length;
    
    return [
      { role: "system" as const, content: systemPrompt },
      { 
        role: "user" as const, 
        content: `${query}

(I have ${sourceCount} relevant sources available to help answer this question. Please provide a comprehensive, analytical response that synthesizes the available information.)` 
      }
    ];
  }

  /**
   * Stream AI worker chat response
   */
  private async *streamAIWorkerChat(
    messages: Array<{role: string, content: string}>
  ): AsyncGenerator<string, void, unknown> {
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
          max_tokens: 1500,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI worker request failed: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("No response body received");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          if (chunk.trim()) {
            yield chunk;
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error("Failed to stream AI worker chat:", error);
      throw error;
    }
  }

  /**
   * Call AI worker chat (non-streaming)
   */
  private async callAIWorkerChat(
    messages: Array<{role: string, content: string}>
  ): Promise<string> {
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
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI worker request failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result.content || "Sorry, I could not generate a response.";
    } catch (error) {
      console.error("Failed to call AI worker:", error);
      return "Sorry, I encountered an error while generating the response.";
    }
  }

  /**
   * Format CSV results into a readable summary
   */
  private formatCsvSummary(csvResult: any): string {
    const exampleRows = csvResult.matchingRows.slice(0, 2);
    let summary = `Found ${csvResult.matchCount} relevant rows:\n`;

    for (const row of exampleRows) {
      const rowText = Object.entries(row)
        .filter(([_, value]) => (value as any).length > 0)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");
      summary += `• ${rowText}\n`;
    }

    if (csvResult.matchingRows.length > 2) {
      summary += `... and ${csvResult.matchingRows.length - 2} more rows`;
    }

    return summary;
  }

  /**
   * Build combined context string for the LLM
   */
  private buildCombinedContext(textResults: any[], csvSources: any[]): string {
    let context = "";

    if (textResults.length > 0) {
      context += "RELEVANT TEXT SOURCES:\n\n";
      textResults.forEach((result, index) => {
        context += `Source ${index + 1} - ${result.metadata.title} (${result.metadata.sourceType}):\n`;
        context += `${result.content}\n\n`;
      });
    }

    if (csvSources.length > 0) {
      context += "RELEVANT CSV DATA:\n\n";
      csvSources.forEach((source, index) => {
        context += `CSV ${index + 1} - ${source.title}:\n`;
        context += `${source.summary}\n\n`;
      });
    }

    if (context === "") {
      context = "No relevant sources found for this query.";
    }

    return context.trim();
  }

  /**
   * Get statistics about indexed sources
   */
  async getStats(): Promise<{
    vectorSources: { count: number };
    csvSources: { count: number; sources: string[] };
  }> {
    const [vectorStats, csvSources] = await Promise.all([
      vectorService.getStats(),
      csvQueryService.getAllSources(),
    ]);

    return {
      vectorSources: vectorStats,
      csvSources: {
        count: csvSources.length,
        sources: csvSources,
      },
    };
  }
}

export const ragService = new RAGService();
