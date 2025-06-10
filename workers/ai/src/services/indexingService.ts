import { readDoc, listenToDoc, ls } from "@tonk/keepsync";
import { vectorService } from "./vectorService";
import { csvQueryService } from "./csvQueryService";

interface SourceDocument {
  id?: string;
  title?: string;
  content?: string;
  rawCsvContent?: string;
  metadata?: {
    type?: "text" | "pdf" | "web" | "csv";
    [key: string]: any;
  };
  [key: string]: any;
}

export class IndexingService {
  private listeners: Map<string, () => void> = new Map();
  private isInitialized = false;
  private watchedPaths = new Set<string>();

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log("Indexing Service: Initializing...");

    // Initialize vector service
    await vectorService.initialize();

    this.isInitialized = true;
    console.log("Indexing Service: Initialized");
  }

  /**
   * Start listening for changes in a specific source document path
   */
  async watchSourceDocument(documentPath: string): Promise<void> {
    if (this.listeners.has(documentPath)) {
      console.log(`Already watching ${documentPath}`);
      return;
    }

    try {
      const unsubscribe = await listenToDoc(
        documentPath,
        async (payload: any) => {
          const doc = payload.doc;
          if (doc && (doc.content || doc.rawCsvContent)) {
            console.log(`Source document changed: ${documentPath}`);
            await this.indexSource(doc, documentPath);
          }
        },
      );

      this.listeners.set(documentPath, unsubscribe);
      console.log(`Indexing Service: Started watching ${documentPath}`);

      // Also index the current document if it exists
      const currentDoc = await readDoc<SourceDocument>(documentPath);
      if (currentDoc && (currentDoc.content || currentDoc.rawCsvContent)) {
        console.log(`Indexing existing document: ${documentPath}`);
        await this.indexSource(currentDoc, documentPath);
      }
    } catch (error) {
      console.error(`Failed to watch source document ${documentPath}:`, error);
    }
  }

  /**
   * Stop watching a specific source document
   */
  stopWatching(documentPath: string): void {
    const unsubscribe = this.listeners.get(documentPath);
    if (unsubscribe) {
      unsubscribe();
      this.listeners.delete(documentPath);
      console.log(`Indexing Service: Stopped watching ${documentPath}`);
    }
  }

  /**
   * Index a source document into the appropriate storage system
   */
  private async indexSource(
    doc: SourceDocument,
    documentPath: string,
  ): Promise<void> {
    try {
      const sourceId = doc.id || documentPath.replace(/\//g, "_");
      const sourceType = doc.metadata?.type || "text";
      const title = doc.title || documentPath.split("/").pop() || "Unknown";

      console.log(
        `Indexing source ${sourceId} of type ${sourceType} from ${documentPath}`,
      );

      // Create a standardized source object
      const source = {
        id: sourceId,
        title: title,
        metadata: { type: sourceType as any, ...doc.metadata },
      };

      switch (sourceType) {
        case "text":
        case "pdf":
        case "web":
          await vectorService.addDocument(source, doc.content!);
          break;
        case "csv":
          // For CSV sources, use rawCsvContent instead of content
          const csvContent = doc.rawCsvContent || doc.content;
          if (csvContent) {
            await csvQueryService.addCSVSource(source, csvContent);
          } else {
            console.warn(`No rawCsvContent or content found for CSV source ${sourceId}`);
          }
          break;
        default:
          // Default to text indexing for unknown types
          await vectorService.addDocument(
            { ...source, metadata: { type: "text" as any } },
            doc.content!,
          );
          break;
      }

      console.log(`Successfully indexed source ${sourceId}`);
    } catch (error) {
      console.error(`Failed to index source from ${documentPath}:`, error);
    }
  }

  /**
   * Watch for source documents in the tonkbook data directory
   */
  async watchSourcesDirectory(): Promise<void> {
    console.log("Indexing Service: Setting up directory monitoring...");

    // Scan and index existing documents in /tonkbook/data
    await this.scanAndIndexExistingDocs();

    // Set up polling to check for new documents periodically
    setInterval(async () => {
      await this.scanAndIndexExistingDocs();
    }, 30000); // Check every 30 seconds

    console.log("Indexing Service: Directory monitoring active");
  }

  /**
   * Scan the /tonkbook/data path for documents and index them
   */
  private async scanAndIndexExistingDocs(): Promise<void> {
    try {
      console.log("Scanning /tonkbook/data for documents...");

      // Try to list documents in the tonkbook/data path
      const dataPath = "tonkbook/data";
      try {
        const docNode = await ls(dataPath);
        console.log(`ls result for ${dataPath}:`, docNode);

        // Handle DocNode structure
        if (docNode && docNode.children) {
          const children = docNode.children;
          console.log(`Found ${children.length} items in ${dataPath}`);

          for (const child of children) {
            if (child.type === "doc") {
              const fullPath = `${dataPath}/${child.name}`;
              if (!this.watchedPaths.has(fullPath)) {
                console.log(`Setting up watch for document: ${fullPath}`);
                await this.watchSourceDocument(fullPath);
                this.watchedPaths.add(fullPath);
              }
            }
          }
        } else {
          console.log("No children found in DocNode or invalid structure");
        }
      } catch (error) {
        console.log(
          "No documents found in /tonkbook/data or path doesn't exist yet:",
          error.message,
        );
      }
    } catch (error) {
      console.error("Error scanning for documents:", error);
    }
  }

  /**
   * Get indexing statistics
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

  /**
   * Clean up all listeners
   */
  cleanup(): void {
    console.log("Indexing Service: Cleaning up listeners...");
    for (const [path, unsubscribe] of this.listeners) {
      unsubscribe();
      console.log(`Stopped watching ${path}`);
    }
    this.listeners.clear();
  }
}

export const indexingService = new IndexingService();

