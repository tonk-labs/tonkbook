export interface DigestQuery {
  id: string;
  title: string;
  query: string;
  priority: "high" | "medium" | "low";
  sources: "web" | "rag" | "both";
  maxResults: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DigestResult {
  queryId: string;
  title: string;
  items: DigestItem[];
  generatedAt: string;
  source: "web" | "rag";
}

export interface DigestItem {
  title: string;
  content: string;
  url?: string;
  score?: number;
  metadata: {
    source: "web" | "rag";
    sourceTitle?: string;
    publishedAt?: string;
    relevanceScore?: number;
  };
}

export interface DailyDigest {
  id: string;
  date: string; // YYYY-MM-DD format
  results: DigestResult[];
  summary?: string;
  totalItems: number;
  generatedAt: string;
  status: "generating" | "completed" | "failed";
}

export interface DigestConfig {
  enabled: boolean;
  generateTime: string; // HH:mm format for daily generation time
  maxItemsPerQuery: number;
  maxTotalItems: number;
  enableAISummary: boolean;
  retentionDays: number; // How many days to keep old digests
}