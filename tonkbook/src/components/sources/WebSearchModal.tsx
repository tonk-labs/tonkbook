import React, { useState } from "react";
import { SearchIcon, ExternalLinkIcon, CheckIcon } from "lucide-react";
import { Source } from "../../types/source";

interface SearchResult {
  title: string;
  url: string;
  description: string;
  favicon?: string;
}

interface WebSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSources: (sources: Omit<Source, "id">[]) => void;
}

const WebSearchModal: React.FC<WebSearchModalProps> = ({
  isOpen,
  onClose,
  onAddSources,
}) => {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(
    new Set(),
  );
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    setSearchResults([]);
    setSelectedResults(new Set());
    setHasSearched(false);

    try {
      // Use proxy server to call Brave Search API
      const searchParams = new URLSearchParams({
        q: query.trim(),
        count: "10",
        offset: "0",
        safesearch: "moderate",
        search_lang: "en",
        country: "US",
        extra_snippets: "true",
      });

      const response = await fetch(
        `http://localhost:6080/api/brave-search/res/v1/web/search?${searchParams}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const results = await response.json();

      if (results.web?.results) {
        const formattedResults: SearchResult[] = results.web.results.map(
          (result: any) => ({
            title: result.title || "Untitled",
            url: result.url,
            description:
              result.description ||
              result.snippet ||
              "No description available",
            favicon: result.profile?.img || result.favicon,
          }),
        );

        setSearchResults(formattedResults);
        setHasSearched(true);
      } else {
        setError("No search results found");
      }
    } catch (err) {
      console.error("Search error:", err);
      if (err instanceof Error) {
        if (err.message.includes("401") || err.message.includes("403")) {
          setError(
            "Invalid API key. Please check your Brave Search API key configuration on the server.",
          );
        } else if (err.message.includes("429")) {
          setError("Rate limit exceeded. Please try again later.");
        } else if (
          err.message.includes("Failed to fetch") ||
          err.message.includes("NetworkError")
        ) {
          setError(
            "Cannot connect to API server. Please ensure the proxy server is running on port 6080.",
          );
        } else {
          setError(`Search failed: ${err.message}`);
        }
      } else {
        setError("Failed to perform search. Please try again.");
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleResultToggle = (url: string) => {
    const newSelected = new Set(selectedResults);
    if (newSelected.has(url)) {
      newSelected.delete(url);
    } else {
      newSelected.add(url);
    }
    setSelectedResults(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedResults.size === searchResults.length) {
      setSelectedResults(new Set());
    } else {
      setSelectedResults(new Set(searchResults.map((result) => result.url)));
    }
  };

  const handleAddSelectedSources = async () => {
    if (selectedResults.size === 0) return;

    setIsProcessing(true);
    setError(null);

    try {
      const selectedUrls = Array.from(selectedResults);
      const scrapedSources: Omit<Source, "id">[] = [];

      // Process each selected URL through the web scraper worker
      for (const url of selectedUrls) {
        try {
          // Generate a custom path in the tonkbook/data folder
          const urlObj = new URL(url);
          const domain = urlObj.hostname.replace(/^www\./, "");
          const timestamp = Date.now();
          const customPath = `tonkbook/data/web-${domain}-${timestamp}`;

          // Call the web scraper worker with custom output path
          const response = await fetch("http://localhost:5555/tonk", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: url,
              outputPath: customPath,
              options: {
                useJavaScript: false,
                timeout: 30000,
                extractImages: false,
                followRedirects: true,
              },
            }),
          });

          if (!response.ok) {
            console.error(`Failed to scrape ${url}: ${response.status}`);
            continue;
          }

          const scrapedData = await response.json();

          if (scrapedData.success && scrapedData.content) {
            // Find the original search result for this URL
            const searchResult = searchResults.find(
              (result) => result.url === url,
            );
            const title =
              scrapedData.content.title ||
              searchResult?.title ||
              "Scraped Content";

            // Create a web source from the scraped content
            const source: Omit<Source, "id"> = {
              title: title,
              path: scrapedData.outputPath,
              metadata: {
                type: "web",
                createdAt: new Date().toISOString(),
              },
            };

            scrapedSources.push(source);
          }
        } catch (err) {
          console.error(`Error scraping ${url}:`, err);
        }
      }

      if (scrapedSources.length > 0) {
        onAddSources(scrapedSources);
        handleClose();
      } else {
        setError(
          "No sources could be scraped successfully. Please check that the web scraper worker is running.",
        );
      }
    } catch (err) {
      console.error("Error processing sources:", err);
      setError("Failed to process selected sources");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setQuery("");
    setSearchResults([]);
    setSelectedResults(new Set());
    setError(null);
    setHasSearched(false);
    setIsSearching(false);
    setIsProcessing(false);
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl mx-4 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Web Search
          </h3>

          {/* Search Input */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyUp={handleKeyPress}
                placeholder="Enter your search query..."
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <SearchIcon
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={18}
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={!query.trim() || isSearching}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isSearching ? "Searching..." : "Search"}
            </button>
          </div>
        </div>

        {error && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {!hasSearched && !isSearching && (
            <div className="text-center py-12">
              <SearchIcon className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-500">
                Enter a search query to find web sources
              </p>
            </div>
          )}

          {isSearching && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-500">Searching the web...</p>
            </div>
          )}

          {hasSearched && searchResults.length === 0 && !isSearching && (
            <div className="text-center py-12">
              <p className="text-gray-500">No results found for "{query}"</p>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-4">
              {/* Select All Button */}
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {selectedResults.size === searchResults.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
                <span className="text-sm text-gray-500">
                  {selectedResults.size} of {searchResults.length} selected
                </span>
              </div>

              {/* Search Results */}
              {searchResults.map((result, _index) => (
                <div
                  key={result.url}
                  className={`border border-gray-200 rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedResults.has(result.url)
                      ? "bg-blue-50 border-blue-300"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => handleResultToggle(result.url)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <div
                        className={`w-5 h-5 border-2 rounded flex items-center justify-center ${
                          selectedResults.has(result.url)
                            ? "bg-blue-600 border-blue-600"
                            : "border-gray-300"
                        }`}
                      >
                        {selectedResults.has(result.url) && (
                          <CheckIcon className="text-white" size={12} />
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {result.favicon && (
                          <img
                            src={result.favicon}
                            alt=""
                            className="w-4 h-4 flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        )}
                        <h4 className="text-lg font-medium text-blue-600 hover:text-blue-700 truncate">
                          {result.title}
                        </h4>
                        <ExternalLinkIcon
                          className="text-gray-400 flex-shrink-0"
                          size={14}
                        />
                      </div>

                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {result.description}
                      </p>

                      <p className="text-xs text-gray-500 truncate">
                        {result.url}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {(hasSearched || selectedResults.size > 0) && (
          <div className="p-6 border-t border-gray-200 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {selectedResults.size > 0 && (
                <>
                  Selected {selectedResults.size} source
                  {selectedResults.size > 1 ? "s" : ""} to scrape
                </>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                disabled={isProcessing}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSelectedSources}
                disabled={selectedResults.size === 0 || isProcessing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing
                  ? "Scraping..."
                  : `Add ${selectedResults.size} Source${selectedResults.size > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebSearchModal;
