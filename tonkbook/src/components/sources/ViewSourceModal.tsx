import React, { useState, useEffect } from "react";
import { readDoc, writeDoc } from "@tonk/keepsync";
import { Source } from "../../types/source";
import ReactMarkdown from "react-markdown";

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

interface ViewSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  source: Source | null;
  onUpdateSource?: (
    id: string,
    updates: Partial<Pick<Source, "title" | "path">>,
  ) => boolean;
}

const ViewSourceModal: React.FC<ViewSourceModalProps> = ({
  isOpen,
  onClose,
  source,
  onUpdateSource,
}) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (source && isOpen) {
      loadSourceContent();
    }
  }, [source, isOpen]);

  const loadSourceContent = async () => {
    if (!source) return;

    try {
      setIsLoading(true);
      setError(null);

      if (source.metadata.type === "web") {
        // For web sources, use the web content interface
        const webData = await readDoc<WebSourceContent>(source.path);
        if (webData) {
          setTitle(webData.title);
          setContent(webData.markdown || "");
        } else {
          setError("Web source content not found");
        }
      } else {
        // For other source types, use the regular content interface
        const sourceData = await readDoc<SourceContent>(source.path);
        if (sourceData) {
          setTitle(sourceData.title);
          if (source.metadata.type === "pdf") {
            setExtractedText(sourceData.content || "");
            setFileSize(sourceData.metadata.fileSize || null);
            setFileName(sourceData.metadata.fileName || "");
            setContent(""); // PDFs don't have editable content
          } else {
            setContent(sourceData.content || "");
          }
        } else {
          setError("Source content not found");
        }
      }
    } catch (err) {
      setError("Failed to load source content");
      console.error("Error loading source content:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!source || !title.trim()) return;

    // Only allow title editing for PDFs, CSVs and web, full editing for text
    if (source.metadata.type === "text" && !content.trim()) return;

    try {
      setIsSaving(true);
      const trimmedTitle = title.trim();

      if (source.metadata.type === "web") {
        // For web sources, use the web content interface
        const existingWebData = await readDoc<WebSourceContent>(source.path);
        if (!existingWebData) {
          setError("Could not load existing web source data");
          return;
        }

        const trimmedContent = content.trim();
        const updatedWebContent: WebSourceContent = {
          ...existingWebData,
          title: trimmedTitle,
          markdown: trimmedContent,
          lastUpdated: new Date().toISOString(),
        };

        await writeDoc(source.path, updatedWebContent);
      } else {
        // For other source types, use the regular content interface
        const existingData = await readDoc<SourceContent>(source.path);
        if (!existingData) {
          setError("Could not load existing source data");
          return;
        }

        let updatedContent: SourceContent;

        if (source.metadata.type === "pdf" || source.metadata.type === "csv" || source.metadata.type === "ai") {
          // For PDFs, CSV files, and AI sources, only update title, preserve all other data
          updatedContent = {
            ...existingData,
            title: trimmedTitle,
          };
        } else {
          // For text, update title and content
          const trimmedContent = content.trim();
          updatedContent = {
            ...existingData,
            title: trimmedTitle,
            content: trimmedContent,
          };
        }

        await writeDoc(source.path, updatedContent);
      }

      // Update the source title in the store if it changed
      if (trimmedTitle !== source.title && onUpdateSource) {
        onUpdateSource(source.id, { title: trimmedTitle });
      }

      setIsEditing(false);
    } catch (err) {
      setError("Failed to save changes");
      console.error("Error saving source content:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (source) {
      loadSourceContent(); // Reload original content
      setIsEditing(false);
    }
  };

  const handleClose = () => {
    setIsEditing(false);
    setTitle("");
    setContent("");
    setExtractedText("");
    setFileName("");
    setFileSize(null);
    setError(null);
    onClose();
  };

  if (!isOpen || !source) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {isEditing ? "Edit Source" : "View Source"}
            </h3>
            <p className="text-sm text-gray-600 mt-1">Path: {source.path}</p>
          </div>
          <div className="flex gap-2">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                {source.metadata.type === "pdf" ||
                source.metadata.type === "csv" ||
                source.metadata.type === "web" ||
                source.metadata.type === "ai"
                  ? "Edit Title"
                  : "Edit"}
              </button>
            )}
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {error && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="p-6 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500">Loading content...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <p className="text-lg font-medium text-gray-900">{title}</p>
                )}
              </div>

              {source.metadata.type === "pdf" ? (
                <div className="space-y-4">
                  {fileName && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        File Name
                      </label>
                      <p className="text-sm text-gray-900">{fileName}</p>
                    </div>
                  )}

                  {fileSize && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        File Size
                      </label>
                      <p className="text-sm text-gray-900">
                        {(fileSize / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Extracted Text
                    </label>
                    <div className="bg-gray-50 rounded-lg p-4 min-h-[400px] border border-gray-200 max-h-[500px] overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700">
                        {extractedText || "No text extracted from this PDF"}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : source.metadata.type === "csv" ? (
                <div className="space-y-4">
                  {fileName && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        File Name
                      </label>
                      <p className="text-sm text-gray-900">{fileName}</p>
                    </div>
                  )}

                  {fileSize && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        File Size
                      </label>
                      <p className="text-sm text-gray-900">
                        {(fileSize / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CSV Content
                    </label>
                    <div className="bg-gray-50 rounded-lg p-4 min-h-[400px] border border-gray-200 max-h-[500px] overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                        {content || "No CSV content available"}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : source.metadata.type === "ai" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    AI Chat Content
                  </label>
                  <div className="bg-white rounded-lg p-6 min-h-[400px] border border-gray-200 max-h-[500px] overflow-y-auto">
                    <div className="prose max-w-none text-gray-900">
                      <ReactMarkdown
                        components={{
                          h1: ({ children }) => (
                            <h1 className="text-2xl font-bold mb-4 text-gray-900">
                              {children}
                            </h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="text-xl font-semibold mb-3 text-gray-900">
                              {children}
                            </h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-lg font-medium mb-2 text-gray-900">
                              {children}
                            </h3>
                          ),
                          p: ({ children }) => (
                            <p className="mb-3 text-gray-700 leading-relaxed">
                              {children}
                            </p>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-semibold text-gray-900">
                              {children}
                            </strong>
                          ),
                          code: ({ children }) => (
                            <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-gray-800">
                              {children}
                            </code>
                          ),
                          pre: ({ children }) => (
                            <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto mb-4">
                              {children}
                            </pre>
                          ),
                          hr: () => (
                            <hr className="border-gray-300 my-6" />
                          ),
                        }}
                      >
                        {content || "No chat content available"}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ) : source.metadata.type === "web" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Markdown Content
                  </label>
                  <div className="bg-white rounded-lg p-6 min-h-[400px] border border-gray-200 max-h-[500px] overflow-y-auto">
                    <div className="prose max-w-none text-gray-900">
                      <ReactMarkdown
                        components={{
                          h1: ({ children }) => (
                            <h1 className="text-2xl font-bold mb-4 text-gray-900">
                              {children}
                            </h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="text-xl font-semibold mb-3 text-gray-900">
                              {children}
                            </h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-lg font-medium mb-2 text-gray-900">
                              {children}
                            </h3>
                          ),
                          p: ({ children }) => (
                            <p className="mb-3 text-gray-700 leading-relaxed">
                              {children}
                            </p>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc list-inside mb-3 text-gray-700">
                              {children}
                            </ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal list-inside mb-3 text-gray-700">
                              {children}
                            </ol>
                          ),
                          li: ({ children }) => (
                            <li className="mb-1">{children}</li>
                          ),
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-gray-300 pl-4 italic my-4 text-gray-600">
                              {children}
                            </blockquote>
                          ),
                          code: ({ children }) => (
                            <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-gray-800">
                              {children}
                            </code>
                          ),
                          pre: ({ children }) => (
                            <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto mb-4">
                              {children}
                            </pre>
                          ),
                          a: ({ children, href }) => (
                            <a
                              href={href}
                              className="text-blue-600 hover:text-blue-800 underline"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {content || "No content available"}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Content
                  </label>
                  {isEditing ? (
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={20}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4 min-h-[400px] border border-gray-200">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                        {content}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {isEditing && (
          <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={
                !title.trim() ||
                (source.metadata.type === "text" && !content.trim()) ||
                isSaving
              }
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewSourceModal;
