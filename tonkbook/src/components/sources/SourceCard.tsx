import React, { useState, useEffect } from "react";
import { XIcon } from "lucide-react";
import { Source } from "../../types/source";
import { readDoc } from "@tonk/keepsync";

interface SourceCardProps {
  source: Source;
  onRemove: (sourceId: string) => void;
  onView: (source: Source) => void;
}

interface SourceContent {
  title: string;
  content: string;
  metadata: {
    type: string;
    createdAt: Date;
    mimeType?: string;
    fileName?: string;
    fileSize?: number;
  };
}

interface WebSourceContent {
  type: "scraped-content";
  url: string;
  title: string;
  content: string;
  markdown: string;
  scrapedAt: string;
  lastUpdated: string;
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

const SourceCard: React.FC<SourceCardProps> = ({
  source,
  onRemove,
  onView,
}) => {
  const [content, setContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadContent = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        if (source.metadata.type === "web") {
          // For web sources, use the web content interface
          const webData = await readDoc<WebSourceContent>(source.path);
          if (webData) {
            const markdown = webData.markdown || "No content available";
            // Strip markdown syntax for preview
            const plainText = markdown
              .replace(/[#*_`~\[\]()]/g, "")
              .replace(/!\[.*?\]\(.*?\)/g, "")
              .replace(/\[.*?\]\(.*?\)/g, "")
              .replace(/\n+/g, " ")
              .trim();
            setContent(plainText.slice(0, 200) + (plainText.length > 200 ? "..." : ""));
          } else {
            setContent("No content available");
          }
        } else {
          // For other source types, use the regular content interface
          const sourceData = await readDoc<SourceContent>(source.path);
          if (source.metadata.type === "pdf") {
            // For PDFs, show extracted text preview and file info
            const extractedText = sourceData?.content || "No text extracted";
            const fileName = sourceData?.metadata.fileName || "Unknown file";
            const fileSize = sourceData?.metadata.fileSize
              ? `${(sourceData.metadata.fileSize / 1024 / 1024).toFixed(1)} MB`
              : "Unknown size";
            setContent(
              `${fileName} (${fileSize})\n${extractedText.slice(0, 200)}${extractedText.length > 200 ? "..." : ""}`,
            );
          } else if (source.metadata.type === "csv") {
            // For CSVs, show file info and data summary
            const fileName = sourceData?.metadata.fileName || "Unknown file";
            const fileSize = sourceData?.metadata.fileSize
              ? `${(sourceData.metadata.fileSize / 1024).toFixed(1)} KB`
              : "Unknown size";
            const content = sourceData?.content || "No data available";
            setContent(
              `${fileName} (${fileSize})\n${content.slice(0, 200)}${content.length > 200 ? "..." : ""}`,
            );
          } else {
            // For text sources, show content
            setContent(sourceData?.content || "Content not found");
          }
        }
      } catch (err) {
        setError("Failed to load content");
        console.error("Error loading source content:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [source.path]);

  const getTypeStyles = (type: string) => {
    switch (type) {
      case "text":
        return "bg-green-100 text-green-700";
      case "pdf":
        return "bg-red-100 text-red-700";
      case "csv":
        return "bg-blue-100 text-blue-700";
      case "web":
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div
      className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors cursor-pointer group relative"
      onClick={() => onView(source)}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(source.id);
        }}
        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
      >
        <XIcon size={14} />
      </button>

      <h3 className="font-medium text-gray-900 text-sm mb-1 pr-6">
        {source.title}
      </h3>

      <div className="flex items-center gap-2 mb-1">
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${getTypeStyles(source.metadata.type)}`}
        >
          {source.metadata?.type}
        </span>
      </div>

      {isLoading ? (
        <p className="text-xs text-gray-500 italic">Loading content...</p>
      ) : error ? (
        <p className="text-xs text-red-500 italic">{error}</p>
      ) : (
        <p className="text-xs text-gray-600 line-clamp-3">{content}</p>
      )}
    </div>
  );
};

export default SourceCard;
