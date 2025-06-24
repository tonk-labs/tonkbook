import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useNotesStore } from "../stores/notesStore";
import { useSourcesStore } from "../stores/sourcesStore";
import { ragService } from "../services/ragService";
import ReactMarkdown from "react-markdown";
import { writeDoc } from "@tonk/keepsync";
import {
  ArrowLeftIcon,
  SendIcon,
  ChevronRightIcon,
  EditIcon,
  CheckIcon,
  XCircleIcon,
  PanelLeft,
  SaveIcon,
  DatabaseIcon,
  AlertCircleIcon,
  CheckCircleIcon,
} from "lucide-react";
import { useIndexingStatus } from "../hooks/useIndexingStatus";
import { Source, ChatMessage } from "../types/source";
import TextSourceModal from "../components/sources/TextSourceModal";
import PDFSourceModal from "../components/sources/PDFSourceModal";
import CSVSourceModal from "../components/sources/CSVSourceModal";
import WebSearchModal from "../components/sources/WebSearchModal";
import SourceCard from "../components/sources/SourceCard";
import AddSourceButtons from "../components/sources/AddSourceButtons";
import ViewSourceModal from "../components/sources/ViewSourceModal";

const NotesView = () => {
  const { noteId } = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const { notes, updateNote } = useNotesStore();
  const { addSource, removeSource, updateSource, getSourcesByNoteId } =
    useSourcesStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Find the current note
  const currentNote = notes.find((note) => note.id === noteId);

  // Filter sources for the current note
  const sources = currentNote ? getSourcesByNoteId(currentNote.id) : [];

  // Title and subheading editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(currentNote?.title || "");
  const [editedSubheading, setEditedSubheading] = useState(
    currentNote?.subheading || "",
  );

  // Sources panel state
  const [isSourcesPanelOpen, setIsSourcesPanelOpen] = useState(true);
  const [showTextInputModal, setShowTextInputModal] = useState(false);
  const [showPDFInputModal, setShowPDFInputModal] = useState(false);
  const [showCSVInputModal, setShowCSVInputModal] = useState(false);
  const [showWebSearchModal, setShowWebSearchModal] = useState(false);
  const [showViewSourceModal, setShowViewSourceModal] = useState(false);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      type: "assistant",
      content:
        "Hello! I'm here to help you with your notes. What would you like to discuss?",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [isAIResponding, setIsAIResponding] = useState(false);

  // Indexing status
  const {
    status: indexingStatus,
    error: indexingError,
    isLoading: indexingLoading,
  } = useIndexingStatus();

  // Update edited values when currentNote changes
  useEffect(() => {
    if (currentNote) {
      setEditedTitle(currentNote.title);
      setEditedSubheading(currentNote.subheading || "");
    }
  }, [currentNote]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "40px";
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 120; // ~5 lines
      textareaRef.current.style.height =
        Math.min(scrollHeight, maxHeight) + "px";
    }
  }, [inputMessage]);

  // Scroll to bottom function
  const scrollToBottom = (smooth = true) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  };

  // Check if user is at bottom of chat
  const checkIfAtBottom = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        messagesContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50; // 50px threshold
      setShowJumpToBottom(!isAtBottom);
    }
  };

  // Handle scroll events
  const handleScroll = () => {
    checkIfAtBottom();
  };

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    scrollToBottom(false);
  }, [messages]);

  // Save title and subheading changes
  const handleSaveTitleChanges = () => {
    if (currentNote && updateNote) {
      updateNote(currentNote.id, {
        title: editedTitle,
        subheading: editedSubheading,
      });
    }
    setIsEditingTitle(false);
  };

  // Cancel title editing
  const handleCancelTitleEdit = () => {
    setEditedTitle(currentNote?.title || "");
    setEditedSubheading(currentNote?.subheading || "");
    setIsEditingTitle(false);
  };

  // Generate RAG-enhanced AI response with streaming
  const generateRAGResponse = async (
    userMessage: string,
    messageId: string,
  ): Promise<void> => {
    setIsAIResponding(true);
    try {
      // Get note content as context (title + subheading)
      const noteContext = currentNote
        ? `Note: ${currentNote.title}${currentNote.subheading ? `\nFocus: ${currentNote.subheading}` : ""}`
        : undefined;

      // Use RAG service to generate streaming response with source context
      const responseGenerator = ragService.generateStreamingResponse(
        userMessage,
        noteContext,
      );

      let accumulatedResponse = "";

      // Stream the response chunks
      for await (const chunk of responseGenerator) {
        accumulatedResponse += chunk;

        // Update the message with accumulated content in real-time
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, content: accumulatedResponse }
              : msg,
          ),
        );
      }
    } catch (error) {
      console.error("RAG response error:", error);
      let errorMessage =
        "Sorry, I'm having trouble responding right now. Please try again.";

      if (error instanceof Error) {
        if (error.message.includes("Failed to fetch")) {
          errorMessage =
            "Unable to connect to AI service. Please ensure the AI worker is running on port 5556.";
        } else {
          errorMessage = `AI service error: ${error.message}`;
        }
      }

      // Update the message with the error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, content: errorMessage } : msg,
        ),
      );
    } finally {
      setIsAIResponding(false);
    }
  };

  // Handle adding text source from modal
  const handleAddTextSource = (sourceData: Omit<Source, "id" | "noteId">) => {
    if (!currentNote) return;
    addSource({ ...sourceData, noteId: currentNote.id });
  };

  // Handle adding PDF source from modal
  const handleAddPDFSource = (sourceData: Omit<Source, "id" | "noteId">) => {
    if (!currentNote) return;
    addSource({ ...sourceData, noteId: currentNote.id });
  };

  // Handle adding CSV source from modal
  const handleAddCSVSource = (sourceData: Omit<Source, "id" | "noteId">) => {
    if (!currentNote) return;
    addSource({ ...sourceData, noteId: currentNote.id });
  };

  // Handle adding multiple sources from web search
  const handleAddWebSearchSources = (
    sources: Omit<Source, "id" | "noteId">[],
  ) => {
    if (!currentNote) return;
    sources.forEach((sourceData) =>
      addSource({ ...sourceData, noteId: currentNote.id }),
    );
  };

  // Handle viewing source
  const handleViewSource = (source: Source) => {
    setSelectedSource(source);
    setShowViewSourceModal(true);
  };

  // Handle closing view source modal
  const handleCloseViewSource = () => {
    setShowViewSourceModal(false);
    setSelectedSource(null);
  };

  // Handle saving chat as AI source
  const handleSaveChatAsSource = async () => {
    if (messages.length <= 1) return; // Don't save if only initial message

    const chatTitle = currentNote?.title
      ? `AI Chat - ${currentNote.title}`
      : `AI Chat - ${new Date().toLocaleDateString()}`;

    // Convert messages to markdown format
    const chatContent = messages
      .filter((msg) => msg.id !== "1") // Exclude initial greeting message
      .map((msg) => {
        const timestamp = msg.timestamp.toLocaleString();
        const role = msg.type === "user" ? "**User**" : "**Assistant**";
        return `${role} (${timestamp}):\n${msg.content}\n`;
      })
      .join("\n---\n\n");

    const sourcePath = `tonkbook/data/${chatTitle}`;

    // Create the AI source content document
    const sourceContent = {
      title: chatTitle,
      content: chatContent,
      messages: messages.filter((msg) => msg.id !== "1"), // Store original messages too
      metadata: {
        type: "ai",
        createdAt: new Date().toISOString(),
        noteId: currentNote?.id,
        noteTitle: currentNote?.title,
      },
    };

    try {
      // Write the content to keepsync
      await writeDoc(sourcePath, sourceContent);

      // Create the source reference for the store
      const sourceReference: Omit<Source, "id"> = {
        title: chatTitle,
        path: sourcePath,
        noteId: currentNote?.id || "",
        metadata: {
          type: "ai",
          createdAt: new Date().toISOString(),
        },
      };

      // Add to sources store
      const sourceId = addSource(sourceReference);

      if (sourceId) {
        // Show success feedback (could add a toast notification here)
        console.log("Chat saved as AI source:", sourceId);
      }
    } catch (error) {
      console.error("Failed to save chat as source:", error);
      // Could add error notification here
    }
  };

  // Handle sending message
  const handleSendMessage = () => {
    if (!inputMessage.trim() || isAIResponding) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: inputMessage.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");

    // Smooth scroll to bottom after sending message
    setTimeout(() => scrollToBottom(true), 100);

    // Generate streaming AI assistant response
    setTimeout(async () => {
      // Create the assistant message placeholder immediately
      const assistantMessageId = (Date.now() + 1).toString();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        type: "assistant",
        content: "", // Start with empty content
        timestamp: new Date(),
      };

      // Add the empty assistant message to trigger streaming
      setMessages((prev) => [...prev, assistantMessage]);

      // Start the RAG response
      await generateRAGResponse(inputMessage.trim(), assistantMessageId);
    }, 500);
  };

  // Handle key press in input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Render indexing status indicator with progress bar
  const renderIndexingStatus = () => {
    if (indexingLoading) {
      return (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400"></div>
          <span>Loading status...</span>
        </div>
      );
    }

    if (indexingError) {
      return (
        <div
          className="flex items-center gap-2 text-sm text-red-600"
          title={indexingError}
        >
          <AlertCircleIcon size={14} />
          <span>Indexing offline</span>
        </div>
      );
    }

    if (indexingStatus) {
      const { progress } = indexingStatus.stats;
      const isHealthy = indexingStatus.isInitialized;
      const isIndexing = progress.isIndexing;
      const batches = progress.batches || {
        totalBatches: 0,
        processedBatches: 0,
        pendingBatches: 0,
      };

      // Calculate progress percentage based on batches for more granular progress
      const batchProgressPercentage =
        batches.totalBatches > 0
          ? Math.round((batches.processedBatches / batches.totalBatches) * 100)
          : 0;

      // Calculate source-level progress as fallback
      const sourceProgressPercentage =
        progress.totalDiscovered > 0
          ? Math.round((progress.indexedCount / progress.totalDiscovered) * 100)
          : 0;

      if (
        isIndexing &&
        (progress.pendingCount > 0 || batches.pendingBatches > 0)
      ) {
        // Show detailed batch progress when actively indexing
        const currentBatch = batches.currentBatchProgress;
        const displayPercentage =
          batches.totalBatches > 0
            ? batchProgressPercentage
            : sourceProgressPercentage;

        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
                <DatabaseIcon size={14} className="text-blue-600" />
              </div>
              <span className="text-blue-700">
                {`Indexing ${progress.indexedCount}/${progress.totalDiscovered} sources (${displayPercentage}%)`}
              </span>
            </div>

            {/* Current batch details */}
            {currentBatch && (
              <div className="text-xs text-gray-600">
                {currentBatch.sourceTitle}: {currentBatch.processedChunks}/
                {currentBatch.totalChunks} chunks
              </div>
            )}

            {/* Progress Bar */}
            <div className="w-full">
              <div className="bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${displayPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        );
      }

      // Show completed state
      return (
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-1">
            {isHealthy ? (
              <CheckCircleIcon size={14} className="text-green-600" />
            ) : (
              <AlertCircleIcon size={14} className="text-yellow-600" />
            )}
            <DatabaseIcon
              size={14}
              className={isHealthy ? "text-green-600" : "text-yellow-600"}
            />
          </div>
          <span className={isHealthy ? "text-green-700" : "text-yellow-700"}>
            {progress.indexedCount} sources indexed (100%)
          </span>
        </div>
      );
    }

    return null;
  };

  if (!currentNote) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Note not found
          </h2>
          <button
            onClick={() => navigate("/")}
            className="text-blue-600 hover:text-blue-700"
          >
            Return to notes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon size={20} />
          </button>
          <div className="flex-1">
            {isEditingTitle ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="text-xl font-semibold text-gray-900 bg-transparent border-b border-gray-300 focus:border-blue-500 focus:outline-none w-full"
                  placeholder="Note title"
                />
                <input
                  type="text"
                  value={editedSubheading}
                  onChange={(e) => setEditedSubheading(e.target.value)}
                  className="text-sm text-gray-600 bg-transparent border-b border-gray-300 focus:border-blue-500 focus:outline-none w-full"
                  placeholder="Subheading (optional)"
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={handleSaveTitleChanges}
                    className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                  >
                    <CheckIcon size={16} />
                  </button>
                  <button
                    onClick={handleCancelTitleEdit}
                    className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                  >
                    <XCircleIcon size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="group">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold text-gray-900">
                    {currentNote.title}
                  </h1>
                  <button
                    onClick={() => setIsEditingTitle(true)}
                    className="p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <EditIcon size={16} />
                  </button>
                </div>
                {currentNote.subheading && (
                  <p className="text-sm text-gray-600">
                    {currentNote.subheading}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Sources Panel */}
        <div
          className={`bg-white border-r border-gray-200 flex flex-col h-full transition-all duration-300 ${
            isSourcesPanelOpen ? "w-1/3" : "w-12"
          }`}
        >
          <div className="p-4 border-b border-gray-200 flex-shrink-0">
            <div
              className={`flex items-center ${isSourcesPanelOpen ? "justify-between" : "justify-center"}`}
            >
              {isSourcesPanelOpen && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Sources
                  </h2>
                  <div className="mt-1">{renderIndexingStatus()}</div>
                </div>
              )}
              <button
                onClick={() => setIsSourcesPanelOpen(!isSourcesPanelOpen)}
                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              >
                <PanelLeft size={20} />
              </button>
            </div>
          </div>

          {isSourcesPanelOpen && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              <AddSourceButtons
                onAddText={() => setShowTextInputModal(true)}
                onAddPdf={() => setShowPDFInputModal(true)}
                onAddCsv={() => setShowCSVInputModal(true)}
                onAddWebSearch={() => setShowWebSearchModal(true)}
              />
              {sources.map((source) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  onRemove={removeSource}
                  onView={handleViewSource}
                />
              ))}
            </div>
          )}
        </div>

        {/* Chat Panel */}
        <div
          className={`${isSourcesPanelOpen ? "w-2/3" : "flex-1"} flex flex-col h-full relative`}
        >
          <div className="p-4 border-b border-gray-200 bg-white flex-shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Chat</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveChatAsSource}
                  disabled={messages.length <= 1}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  title="Save chat as AI source"
                >
                  <SaveIcon size={16} />
                  Save as Source
                </button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.type === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-200 text-gray-900"
                  }`}
                >
                  {message.type === "assistant" ? (
                    <div className="text-sm prose prose-sm max-w-none prose-headings:text-gray-900 prose-headings:font-semibold prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-p:text-sm prose-p:text-gray-900 prose-strong:text-gray-900 prose-code:text-gray-800 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded">
                      <ReactMarkdown>
                        {message.content +
                          (isAIResponding &&
                          message.id === messages[messages.length - 1]?.id
                            ? "▋"
                            : "")}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">
                      {message.content}
                    </p>
                  )}
                  <p
                    className={`text-xs mt-1 ${
                      message.type === "user"
                        ? "text-blue-100"
                        : "text-gray-500"
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Jump to Bottom Button */}
          {showJumpToBottom && (
            <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-10">
              <button
                onClick={() => scrollToBottom(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-full shadow-lg transition-all duration-200 flex items-center gap-2 animate-fade-in"
              >
                Jump to bottom
                <ChevronRightIcon size={16} className="rotate-90" />
              </button>
            </div>
          )}

          {/* Sticky Input */}
          <div className="p-4 bg-white border-t border-gray-200 flex-shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyUp={handleKeyPress}
                placeholder="Type your message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none overflow-hidden"
                rows={1}
                style={{ minHeight: "40px", maxHeight: "120px" }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isAIResponding}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center h-10"
              >
                {isAIResponding ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <SendIcon size={18} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <TextSourceModal
        isOpen={showTextInputModal}
        onClose={() => setShowTextInputModal(false)}
        onAddSource={handleAddTextSource}
      />

      <PDFSourceModal
        isOpen={showPDFInputModal}
        onClose={() => setShowPDFInputModal(false)}
        onAddSource={handleAddPDFSource}
      />

      <CSVSourceModal
        isOpen={showCSVInputModal}
        onClose={() => setShowCSVInputModal(false)}
        onAddSource={handleAddCSVSource}
      />

      <WebSearchModal
        isOpen={showWebSearchModal}
        onClose={() => setShowWebSearchModal(false)}
        onAddSources={handleAddWebSearchSources}
      />

      <ViewSourceModal
        isOpen={showViewSourceModal}
        onClose={handleCloseViewSource}
        source={selectedSource}
        onUpdateSource={updateSource}
      />
    </div>
  );
};

export default NotesView;
