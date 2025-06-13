import React, { useState } from 'react';
import { Calendar, Clock, ExternalLink, ChevronDown, ChevronUp, Globe, Database, Sparkles } from 'lucide-react';
import { DailyDigest, DigestResult, DigestItem } from '../../types/digest';

interface DigestCardProps {
  digest: DailyDigest;
}

const DigestCard: React.FC<DigestCardProps> = ({ digest }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const toggleResultExpansion = (queryId: string) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(queryId)) {
      newExpanded.delete(queryId);
    } else {
      newExpanded.add(queryId);
    }
    setExpandedResults(newExpanded);
  };

  const getSourceIcon = (source: "web" | "rag") => {
    return source === "web" ? (
      <Globe className="w-4 h-4 text-green-600" />
    ) : (
      <Database className="w-4 h-4 text-purple-600" />
    );
  };

  const getStatusBadge = () => {
    switch (digest.status) {
      case "completed":
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">Completed</span>;
      case "generating":
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">Generating...</span>;
      case "failed":
        return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">Failed</span>;
      default:
        return null;
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-900">
              Daily Digest - {new Date(digest.date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </h3>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge()}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Summary Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">
              {new Date(digest.generatedAt).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit'
              })}
            </span>
          </div>
          
          <div className="text-gray-600">
            <span className="font-medium">{digest.totalItems}</span> items
          </div>
          
          <div className="text-gray-600">
            <span className="font-medium">{digest.results.length}</span> queries
          </div>
          
          {digest.summary && (
            <div className="flex items-center gap-1 text-blue-600">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm">AI Summary</span>
            </div>
          )}
        </div>

        {/* AI Summary */}
        {digest.summary && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="flex items-center gap-2 text-sm font-medium text-blue-900 mb-2">
              <Sparkles className="w-4 h-4" />
              Daily Summary
            </h4>
            <p className="text-sm text-blue-800 leading-relaxed">
              {digest.summary}
            </p>
          </div>
        )}

        {/* Expanded Content */}
        {isExpanded && digest.status === "completed" && (
          <div className="border-t border-gray-200 pt-4">
            <div className="space-y-4">
              {digest.results.map((result) => (
                <div key={`${result.queryId}-${result.source}`} className="border border-gray-100 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getSourceIcon(result.source)}
                      <h4 className="font-medium text-gray-900">{result.title}</h4>
                      <span className="text-sm text-gray-500">
                        ({result.items.length} items)
                      </span>
                    </div>
                    
                    <button
                      onClick={() => toggleResultExpansion(`${result.queryId}-${result.source}`)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {expandedResults.has(`${result.queryId}-${result.source}`) ? 'Show Less' : 'Show All'}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {result.items.slice(0, expandedResults.has(`${result.queryId}-${result.source}`) ? undefined : 2).map((item, index) => (
                      <DigestItemCard key={index} item={item} />
                    ))}
                    
                    {!expandedResults.has(`${result.queryId}-${result.source}`) && result.items.length > 2 && (
                      <div className="text-center">
                        <button
                          onClick={() => toggleResultExpansion(`${result.queryId}-${result.source}`)}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          + {result.items.length - 2} more items
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const DigestItemCard: React.FC<{ item: DigestItem }> = ({ item }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const truncatedContent = item.content.length > 150 
    ? item.content.substring(0, 150) + "..."
    : item.content;

  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-start justify-between mb-2">
        <h5 className="font-medium text-gray-900 text-sm leading-tight">
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              {item.title}
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            item.title
          )}
        </h5>
        
        {item.metadata.relevanceScore && (
          <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
            {Math.round(item.metadata.relevanceScore * 100)}% match
          </span>
        )}
      </div>
      
      <p className="text-sm text-gray-600 leading-relaxed">
        {isExpanded ? item.content : truncatedContent}
        {item.content.length > 150 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-1 text-blue-600 hover:text-blue-700 font-medium"
          >
            {isExpanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </p>
      
      {item.metadata.publishedAt && (
        <p className="text-xs text-gray-500 mt-2">
          Published: {item.metadata.publishedAt}
        </p>
      )}
    </div>
  );
};

export default DigestCard;