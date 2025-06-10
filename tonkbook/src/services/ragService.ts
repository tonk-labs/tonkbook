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
   * Generate an AI response using RAG context
   */
  async generateResponse(
    query: string,
    noteContext?: string,
    options?: QueryOptions,
  ): Promise<{ response: string; sources: RAGResult }> {
    const ragResult = await this.queryRelevantSources(query, options);

    const systemPrompt = this.buildSystemPrompt(ragResult, noteContext);
    const userPrompt = this.buildUserPrompt(query, ragResult);

    const aiResponse = await this.callAIWorker(systemPrompt, userPrompt);

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
    let prompt = `You are a helpful assistant with access to relevant information from various sources. Use the provided context to answer questions accurately and cite your sources when appropriate.

AVAILABLE CONTEXT:
${ragResult.combinedContext}`;

    if (noteContext) {
      prompt += `\n\nCURRENT NOTE CONTEXT:
${noteContext}`;
    }

    prompt += `\n\nInstructions:
- Use the provided context to answer questions
- If information is not available in the context, say so clearly
- When referencing specific information, mention the source
- For CSV data, you can reference specific data points
- Be concise but thorough in your responses`;

    return prompt;
  }

  /**
   * Build user prompt
   */
  private buildUserPrompt(query: string, ragResult: RAGResult): string {
    const sourceCount =
      ragResult.textSources.length + ragResult.csvSources.length;
    return `${query}

(I have ${sourceCount} relevant sources available for this query)`;
  }

  /**
   * Call the AI worker for response generation
   */
  private async callAIWorker(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    try {
      const response = await fetch("http://localhost:5556/api/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: userPrompt,
          system: systemPrompt,
          model: "gpt-3.5-turbo",
          temperature: 0.7,
          max_tokens: 500,
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
