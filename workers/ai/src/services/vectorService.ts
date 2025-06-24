import { ChromaClient } from "chromadb";

interface SourceDocument {
  id: string;
  title: string;
  metadata: {
    type: "text" | "pdf" | "web" | "csv";
    [key: string]: any;
  };
}

interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    sourceId: string;
    sourceType: SourceDocument["metadata"]["type"];
    chunkIndex: number;
    title: string;
  };
}

interface SearchResult {
  content: string;
  metadata: DocumentChunk["metadata"];
  score: number;
}

export class VectorService {
  private client: ChromaClient;
  private collection: any;
  private initialized = false;

  constructor() {
    this.client = new ChromaClient({
      port: 8888,
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log(
        "Vector Service: Initializing connection to Chroma at http://localhost:8888",
      );
      this.collection = await this.client.getOrCreateCollection({
        name: "tonkbook_sources",
        metadata: { description: "Tonkbook source documents for RAG" },
      });
      console.log("Vector Service: Successfully initialized collection");
      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize vector service:", error);
      throw error;
    }
  }

  /**
   * Calculate the number of chunks a document would be split into without actually processing it
   */
  calculateChunkCount(content: string): number {
    const maxChunkSize = 800; // characters
    const overlap = 150; // character overlap between chunks

    let startIndex = 0;
    let chunkCount = 0;

    while (startIndex < content.length) {
      const endIndex = Math.min(startIndex + maxChunkSize, content.length);
      const chunkContent = content.slice(startIndex, endIndex);

      // Try to break at sentence boundaries (same logic as chunkDocument)
      let actualEndIndex = endIndex;
      if (endIndex < content.length) {
        const lastSentenceEnd = chunkContent.lastIndexOf(". ");
        if (lastSentenceEnd > maxChunkSize * 0.7) {
          actualEndIndex = startIndex + lastSentenceEnd + 1;
        }
      }

      const finalContent = content.slice(startIndex, actualEndIndex).trim();
      if (finalContent.length > 0) {
        chunkCount++;
      }

      startIndex = Math.max(actualEndIndex - overlap, startIndex + 1);
      if (startIndex >= actualEndIndex) break;
    }

    return chunkCount;
  }

  /**
   * Get all source IDs that are currently indexed in the vector database
   */
  async getExistingSources(): Promise<Set<string>> {
    await this.initialize();

    try {
      // Get all documents and extract unique source IDs
      const results = await this.collection.get({
        include: ["metadatas"],
      });

      const sourceIds = new Set<string>();

      if (results.metadatas) {
        for (const metadata of results.metadatas) {
          if (metadata && metadata.sourceId) {
            sourceIds.add(metadata.sourceId);
          }
        }
      }

      console.log(
        `Vector Service: Found ${sourceIds.size} existing sources in ChromaDB`,
      );
      return sourceIds;
    } catch (error) {
      console.error("Failed to get existing sources from ChromaDB:", error);
      return new Set();
    }
  }

  /**
   * Add a source document to the vector database
   */
  async addDocument(
    source: SourceDocument,
    content: string,
    onBatchProgress?: (
      batchIndex: number,
      totalBatches: number,
      processedChunks: number,
      totalChunks: number,
    ) => void,
  ): Promise<void> {
    console.log(`Vector Service: Adding document for source ${source.id}`);
    await this.initialize();

    // Remove existing chunks for this source first
    await this.removeDocument(source.id);

    const chunks = this.chunkDocument(content, source);
    console.log(
      `Vector Service: Created ${chunks.length} chunks for source ${source.id}`,
    );

    if (chunks.length === 0) return;

    const ids = chunks.map((chunk) => chunk.id);
    const documents = chunks.map((chunk) => chunk.content);
    const metadatas = chunks.map((chunk) => chunk.metadata);

    console.log(
      `Vector Service: Adding ${chunks.length} chunks to Chroma collection`,
    );

    // Add chunks in smaller batches to avoid overwhelming Chroma
    const batchSize = 25;
    const totalBatches = Math.ceil(chunks.length / batchSize);

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batchEnd = Math.min(i + batchSize, chunks.length);
      const batchIds = ids.slice(i, batchEnd);
      const batchDocuments = documents.slice(i, batchEnd);
      const batchMetadatas = metadatas.slice(i, batchEnd);
      const batchIndex = Math.floor(i / batchSize) + 1;

      console.log(
        `Vector Service: Adding batch ${batchIndex}/${totalBatches} (${batchIds.length} chunks)`,
      );

      // Report progress before processing batch
      if (onBatchProgress) {
        onBatchProgress(batchIndex - 1, totalBatches, i, chunks.length);
      }

      try {
        await this.collection.add({
          ids: batchIds,
          documents: batchDocuments,
          metadatas: batchMetadatas,
        });
        console.log(`Vector Service: Successfully added batch ${batchIndex}`);

        // Report progress after processing batch
        if (onBatchProgress) {
          onBatchProgress(batchIndex, totalBatches, batchEnd, chunks.length);
        }

        // Small delay between batches
        if (i + batchSize < chunks.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(
          `Vector Service: Failed to add batch ${batchIndex}:`,
          error,
        );
        throw error;
      }
    }

    console.log(
      `Vector Service: Successfully added all ${chunks.length} chunks for source ${source.id}`,
    );
  }

  /**
   * Remove a source document from the vector database
   */
  async removeDocument(sourceId: string): Promise<void> {
    await this.initialize();

    try {
      await this.collection.delete({
        where: { sourceId },
      });
      console.log(`Vector Service: Removed source ${sourceId}`);
    } catch (error) {
      // Don't throw error if document doesn't exist
      console.log(
        `Vector Service: Source ${sourceId} not found or already removed`,
      );
    }
  }

  /**
   * Search for relevant documents using vector similarity
   */
  async search(query: string, topK: number = 5): Promise<SearchResult[]> {
    await this.initialize();

    const results = await this.collection.query({
      queryTexts: [query],
      nResults: topK,
      include: ["documents", "metadatas", "distances"],
    });

    if (
      !results.documents?.[0] ||
      !results.metadatas?.[0] ||
      !results.distances?.[0]
    ) {
      return [];
    }

    return results.documents[0].map((doc: string, index: number) => ({
      content: doc,
      metadata: results.metadatas![0][index] as DocumentChunk["metadata"],
      score: 1 - (results.distances![0][index] || 0), // Convert distance to similarity score
    }));
  }

  /**
   * Split document content into manageable chunks
   */
  private chunkDocument(
    content: string,
    source: SourceDocument,
  ): DocumentChunk[] {
    const maxChunkSize = 800; // characters
    const overlap = 150; // character overlap between chunks

    const chunks: DocumentChunk[] = [];
    let startIndex = 0;
    let chunkIndex = 0;

    while (startIndex < content.length) {
      const endIndex = Math.min(startIndex + maxChunkSize, content.length);
      const chunkContent = content.slice(startIndex, endIndex);

      // Try to break at sentence boundaries
      let actualEndIndex = endIndex;
      if (endIndex < content.length) {
        const lastSentenceEnd = chunkContent.lastIndexOf(". ");
        if (lastSentenceEnd > maxChunkSize * 0.7) {
          // Only if we don't lose too much content
          actualEndIndex = startIndex + lastSentenceEnd + 1;
        }
      }

      const finalContent = content.slice(startIndex, actualEndIndex).trim();

      if (finalContent.length > 0) {
        chunks.push({
          id: `${source.id}_chunk_${chunkIndex}`,
          content: finalContent,
          metadata: {
            sourceId: source.id,
            sourceType: source.metadata.type,
            chunkIndex,
            title: source.title,
          },
        });
        chunkIndex++;
      }

      startIndex = Math.max(actualEndIndex - overlap, startIndex + 1);

      if (startIndex >= actualEndIndex) break;
    }

    return chunks;
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<{ count: number }> {
    await this.initialize();

    const count = await this.collection.count();
    return { count };
  }
}

export const vectorService = new VectorService();
