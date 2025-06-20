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
  private pendingIndexing = new Set<string>();
  private indexedVectorSources = new Set<string>();
  private indexedCsvSources = new Set<string>();
  private lastIndexingActivity = new Date();
  private totalSourcesFound = 0;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log("Indexing Service: Initializing...");

    // Initialize vector service
    await vectorService.initialize();

    // Initialize tracked sources by scanning existing CSV sources
    // (Vector sources will be added as they're discovered and indexed)
    await this.initializeTrackedSources();

    this.isInitialized = true;
    console.log("Indexing Service: Initialized");
  }

  /**
   * Initialize tracked sources from existing data
   */
  private async initializeTrackedSources(): Promise<void> {
    try {
      // Get existing CSV sources and add them to our tracking
      const existingCsvSources = csvQueryService.getAllSources();
      existingCsvSources.forEach((sourceId) => {
        this.indexedCsvSources.add(sourceId);
      });

      console.log(
        `Indexing Service: Initialized tracking for ${existingCsvSources.length} existing CSV sources`,
      );
    } catch (error) {
      console.warn("Failed to initialize tracked sources:", error);
    }
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
            this.pendingIndexing.add(documentPath);
            this.lastIndexingActivity = new Date();
            await this.indexSource(doc, documentPath);
          }
        },
      );

      this.listeners.set(documentPath, unsubscribe);
      console.log(`Indexing Service: Started watching ${documentPath}`);

      // Also index the current document if it exists
      const currentDoc = await readDoc<SourceDocument>(documentPath);
      if (currentDoc && (currentDoc.content || currentDoc.rawCsvContent)) {
        const sourceId = currentDoc.id || documentPath.replace(/\//g, "_");
        const sourceType = currentDoc.metadata?.type || "text";

        // Check if already tracked to avoid re-indexing during startup
        const isAlreadyTracked =
          (sourceType === "csv" && this.indexedCsvSources.has(sourceId)) ||
          (sourceType !== "csv" && this.indexedVectorSources.has(sourceId));

        if (!isAlreadyTracked) {
          console.log(`Indexing existing document: ${documentPath}`);
          this.pendingIndexing.add(documentPath);
          this.lastIndexingActivity = new Date();
          await this.indexSource(currentDoc, documentPath);
        } else {
          console.log(
            `Document already tracked: ${documentPath} (${sourceId})`,
          );
        }
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
          this.indexedVectorSources.add(sourceId);
          break;
        case "csv":
          // For CSV sources, use rawCsvContent instead of content
          const csvContent = doc.rawCsvContent || doc.content;
          if (csvContent) {
            await csvQueryService.addCSVSource(source, csvContent);
            this.indexedCsvSources.add(sourceId);
          } else {
            console.warn(
              `No rawCsvContent or content found for CSV source ${sourceId}`,
            );
          }
          break;
        default:
          // Default to text indexing for unknown types
          await vectorService.addDocument(
            { ...source, metadata: { type: "text" as any } },
            doc.content!,
          );
          this.indexedVectorSources.add(sourceId);
          break;
      }

      console.log(`Successfully indexed source ${sourceId}`);

      // Remove from pending
      this.pendingIndexing.delete(documentPath);
      this.lastIndexingActivity = new Date();
    } catch (error) {
      console.error(`Failed to index source from ${documentPath}:`, error);
      // Remove from pending even if failed to avoid stuck state
      this.pendingIndexing.delete(documentPath);
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
          const docChildren = children.filter((child) => child.type === "doc");
          this.totalSourcesFound = docChildren.length;
          console.log(
            `Found ${docChildren.length} source documents in ${dataPath}`,
          );

          for (const child of docChildren) {
            const fullPath = `${dataPath}/${child.name}`;
            if (!this.watchedPaths.has(fullPath)) {
              console.log(`Setting up watch for document: ${fullPath}`);
              this.pendingIndexing.add(fullPath);
              this.lastIndexingActivity = new Date();
              await this.watchSourceDocument(fullPath);
              this.watchedPaths.add(fullPath);
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
    progress: {
      pendingCount: number;
      indexedCount: number;
      totalDiscovered: number;
      isIndexing: boolean;
      lastActivity: string;
    };
  }> {
    // Get CSV sources from the service to stay consistent
    const csvSources = csvQueryService.getAllSources();

    // Use our tracked counts for actual source documents (not chunks)
    const vectorSourceCount = this.indexedVectorSources.size;
    const csvSourceCount = this.indexedCsvSources.size;
    const totalIndexed = vectorSourceCount + csvSourceCount;
    const totalDiscovered = this.totalSourcesFound; // Total sources found in directory
    const pendingCount = totalDiscovered - totalIndexed; // Remaining to index

    // Consider indexing active if there's pending work or recent activity (last 10 seconds)
    const isIndexing =
      pendingCount > 0 ||
      Date.now() - this.lastIndexingActivity.getTime() < 10000;

    return {
      vectorSources: { count: vectorSourceCount },
      csvSources: {
        count: csvSourceCount,
        sources: csvSources,
      },
      progress: {
        pendingCount,
        indexedCount: totalIndexed,
        totalDiscovered,
        isIndexing,
        lastActivity: this.lastIndexingActivity.toISOString(),
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
