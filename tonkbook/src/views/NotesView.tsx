import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useNotesStore } from "../stores/notesStore";
import { useSourcesStore } from "../stores/sourcesStore";
import {
  ArrowLeftIcon,
  SendIcon,
  ChevronRightIcon,
  EditIcon,
  CheckIcon,
  XCircleIcon,
  PanelLeft,
} from "lucide-react";
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
  const { sources, addSource, removeSource, updateSource } = useSourcesStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Find the current note
  const currentNote = notes.find((note) => note.id === noteId);

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

  // Generate streaming AI response using the AI worker
  const generateStreamingAIResponse = async (userMessage: string, messageId: string): Promise<void> => {
    setIsAIResponding(true);
    try {
      // Build the conversation history for context
      const conversationHistory = messages
        .filter(msg => msg.type === "user" || msg.type === "assistant")
        .map(msg => ({
          role: msg.type === "user" ? "user" : "assistant" as const,
          content: msg.content
        }));

      // Add the new user message
      conversationHistory.push({
        role: "user" as const,
        content: userMessage
      });

      const response = await fetch("http://localhost:5556/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `You are a helpful assistant helping with note-taking and research for the note titled "${currentNote?.title}". ${currentNote?.subheading ? `The note's focus is: ${currentNote.subheading}. ` : ""}The user has ${sources.length} sources available for reference. Be concise and informative.`
            },
            ...conversationHistory
          ],
          model: "gpt-3.5-turbo",
          temperature: 0.7,
          max_tokens: 150,
          stream: true
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";

      if (!reader) {
        throw new Error("No response body reader available");
      }

      // Read the stream
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        accumulatedContent += chunk;

        // Update the message with the accumulated content
        setMessages((prev) => 
          prev.map((msg) => 
            msg.id === messageId 
              ? { ...msg, content: accumulatedContent }
              : msg
          )
        );

        // Auto-scroll to bottom during streaming
        setTimeout(() => scrollToBottom(true), 10);
      }

    } catch (error) {
      console.error("AI streaming response error:", error);
      let errorMessage = "Sorry, I'm having trouble responding right now. Please try again.";
      
      if (error instanceof Error) {
        if (error.message.includes("Failed to fetch")) {
          errorMessage = "Unable to connect to AI service. Please ensure the AI worker is running on port 5556.";
        } else {
          errorMessage = `AI service error: ${error.message}`;
        }
      }

      // Update the message with the error
      setMessages((prev) => 
        prev.map((msg) => 
          msg.id === messageId 
            ? { ...msg, content: errorMessage }
            : msg
        )
      );
    } finally {
      setIsAIResponding(false);
    }
  };

  // Handle adding text source from modal
  const handleAddTextSource = (sourceData: Omit<Source, "id">) => {
    addSource(sourceData);
  };

  // Handle adding PDF source from modal
  const handleAddPDFSource = (sourceData: Omit<Source, "id">) => {
    addSource(sourceData);
  };

  // Handle adding CSV source from modal
  const handleAddCSVSource = (sourceData: Omit<Source, "id">) => {
    addSource(sourceData);
  };

  // Handle adding multiple sources from web search
  const handleAddWebSearchSources = (sources: Omit<Source, "id">[]) => {
    sources.forEach(sourceData => addSource(sourceData));
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

      // Start the streaming response
      await generateStreamingAIResponse(inputMessage.trim(), assistantMessageId);
    }, 500);
  };

  // Handle key press in input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
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
                <h2 className="text-lg font-semibold text-gray-900">Sources</h2>
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
            <h2 className="text-lg font-semibold text-gray-900">Chat</h2>
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
                  <p className="text-sm whitespace-pre-wrap">
                    {message.content}
                    {message.type === "assistant" && isAIResponding && message.id === messages[messages.length - 1]?.id && (
                      <span className="inline-block ml-1 animate-pulse">▋</span>
                    )}
                  </p>
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
