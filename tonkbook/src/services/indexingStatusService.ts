const AI_WORKER_URL = import.meta.env.VITE_AI_WORKER_URL || 'http://localhost:5556';

export interface IndexingStats {
  vectorSources: { count: number };
  csvSources: { count: number; sources: string[] };
  progress: {
    pendingCount: number;
    indexedCount: number;
    totalDiscovered: number;
    isIndexing: boolean;
    lastActivity: string;
  };
}

export interface IndexingStatus {
  stats: IndexingStats;
  watchedPaths: string[];
  isInitialized: boolean;
  timestamp: string;
}

export interface IndexingStatusError {
  error: string;
}

export class IndexingStatusService {
  async getStatus(): Promise<IndexingStatus | IndexingStatusError> {
    try {
      const response = await fetch(`${AI_WORKER_URL}/api/indexing/status`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch indexing status:', error);
      return { 
        error: error instanceof Error ? error.message : 'Failed to fetch indexing status' 
      };
    }
  }
}

export const indexingStatusService = new IndexingStatusService();