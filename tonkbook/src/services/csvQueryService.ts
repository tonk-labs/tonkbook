import Papa from "papaparse";
import { Source } from "../types/source";

interface CSVData {
  headers: string[];
  rows: Record<string, string>[];
}

interface CSVQueryResult {
  sourceId: string;
  title: string;
  matchingRows: Record<string, string>[];
  totalRows: number;
  matchCount: number;
}

export class CSVQueryService {
  private csvCache = new Map<string, CSVData>();
  private sourceMetadata = new Map<string, { title: string; source: Source }>();

  /**
   * Parse and cache CSV content
   */
  async addCSVSource(source: Source, csvContent: string): Promise<void> {
    if (source.metadata.type !== "csv") {
      throw new Error("Source must be of type CSV");
    }

    const parseResult = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
    });

    if (parseResult.errors.length > 0) {
      console.warn(
        `CSV parsing warnings for ${source.id}:`,
        parseResult.errors,
      );
    }

    const csvData: CSVData = {
      headers: parseResult.meta.fields || [],
      rows: parseResult.data as Record<string, string>[],
    };

    this.csvCache.set(source.id, csvData);
    this.sourceMetadata.set(source.id, { title: source.title, source });
  }

  /**
   * Remove CSV source from cache
   */
  removeCSVSource(sourceId: string): void {
    this.csvCache.delete(sourceId);
    this.sourceMetadata.delete(sourceId);
  }

  /**
   * Query CSV data using flexible search terms
   */
  queryCSV(query: string, maxResults: number = 10): CSVQueryResult[] {
    const results: CSVQueryResult[] = [];
    const searchTerms = query.toLowerCase().split(/\s+/);

    for (const [sourceId, csvData] of this.csvCache.entries()) {
      const matchingRows: Record<string, string>[] = [];

      for (const row of csvData.rows) {
        const rowText = Object.values(row).join(" ").toLowerCase();

        // Check if all search terms are present in the row
        const matchesAll = searchTerms.every((term) => rowText.includes(term));

        if (matchesAll) {
          matchingRows.push(row);
        }

        if (matchingRows.length >= maxResults) break;
      }

      if (matchingRows.length > 0) {
        results.push({
          sourceId,
          title: this.getSourceTitle(sourceId),
          matchingRows,
          totalRows: csvData.rows.length,
          matchCount: matchingRows.length,
        });
      }
    }

    return results.sort((a, b) => b.matchCount - a.matchCount);
  }

  /**
   * Query specific columns with exact or partial matching
   */
  queryColumns(
    columnQueries: Record<string, string>,
    maxResults: number = 10,
  ): CSVQueryResult[] {
    const results: CSVQueryResult[] = [];

    for (const [sourceId, csvData] of this.csvCache.entries()) {
      const matchingRows: Record<string, string>[] = [];

      for (const row of csvData.rows) {
        let matches = true;

        for (const [column, searchValue] of Object.entries(columnQueries)) {
          const columnValue = row[column]?.toLowerCase() || "";
          const searchTerm = searchValue.toLowerCase();

          if (!columnValue.includes(searchTerm)) {
            matches = false;
            break;
          }
        }

        if (matches) {
          matchingRows.push(row);
        }

        if (matchingRows.length >= maxResults) break;
      }

      if (matchingRows.length > 0) {
        results.push({
          sourceId,
          title: this.getSourceTitle(sourceId),
          matchingRows,
          totalRows: csvData.rows.length,
          matchCount: matchingRows.length,
        });
      }
    }

    return results.sort((a, b) => b.matchCount - a.matchCount);
  }

  /**
   * Get column names for a CSV source
   */
  getColumns(sourceId: string): string[] {
    const csvData = this.csvCache.get(sourceId);
    return csvData?.headers || [];
  }

  /**
   * Get summary statistics for a CSV source
   */
  getCSVStats(
    sourceId: string,
  ): { headers: string[]; rowCount: number } | null {
    const csvData = this.csvCache.get(sourceId);
    if (!csvData) return null;

    return {
      headers: csvData.headers,
      rowCount: csvData.rows.length,
    };
  }

  /**
   * Smart query that attempts to understand natural language queries
   */
  smartQuery(query: string, maxResults: number = 10): CSVQueryResult[] {
    // First try general text search
    const textResults = this.queryCSV(query, maxResults);

    // Try to detect column-specific queries (e.g., "name contains John")
    const columnMatch = query.match(
      /(\w+)\s+(contains?|equals?|is)\s+([^,]+)/i,
    );
    if (columnMatch) {
      const [, column, , value] = columnMatch;
      const columnResults = this.queryColumns({ [column]: value }, maxResults);

      // Combine and deduplicate results
      const combined = [...textResults];
      for (const result of columnResults) {
        if (!combined.find((r) => r.sourceId === result.sourceId)) {
          combined.push(result);
        }
      }

      return combined.sort((a, b) => b.matchCount - a.matchCount);
    }

    return textResults;
  }

  /**
   * Get a summary of matching data for RAG context
   */
  getQuerySummary(query: string, maxResults: number = 5): string {
    const results = this.smartQuery(query, maxResults);

    if (results.length === 0) {
      return `No CSV data found matching "${query}".`;
    }

    let summary = `Found ${results.length} CSV source(s) with relevant data for "${query}":\n\n`;

    for (const result of results) {
      summary += `**${result.title}** (${result.matchCount}/${result.totalRows} rows):\n`;

      // Show first few matching rows as examples
      const exampleRows = result.matchingRows.slice(0, 3);
      for (const row of exampleRows) {
        const rowSummary = Object.entries(row)
          .filter(([_, value]) => value.length > 0)
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ");
        summary += `- ${rowSummary}\n`;
      }

      if (result.matchingRows.length > 3) {
        summary += `... and ${result.matchingRows.length - 3} more rows\n`;
      }
      summary += "\n";
    }

    return summary.trim();
  }

  private getSourceTitle(sourceId: string): string {
    const metadata = this.sourceMetadata.get(sourceId);
    return metadata?.title || `CSV Source ${sourceId}`;
  }

  /**
   * Get all cached CSV sources
   */
  getAllSources(): string[] {
    return Array.from(this.csvCache.keys());
  }

  /**
   * Get all CSV sources with metadata
   */
  getAllSourcesWithMetadata(): Array<{ id: string; title: string; headers: string[]; rowCount: number }> {
    const result: Array<{ id: string; title: string; headers: string[]; rowCount: number }> = [];
    
    for (const [sourceId, csvData] of this.csvCache.entries()) {
      const metadata = this.sourceMetadata.get(sourceId);
      result.push({
        id: sourceId,
        title: metadata?.title || `CSV Source ${sourceId}`,
        headers: csvData.headers,
        rowCount: csvData.rows.length,
      });
    }
    
    return result;
  }
}

export const csvQueryService = new CSVQueryService();
