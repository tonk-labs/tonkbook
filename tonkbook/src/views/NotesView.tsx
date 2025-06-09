import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNotesStore } from '../stores/notesStore';
import { ArrowLeftIcon, PlusIcon, SendIcon, ChevronLeftIcon, ChevronRightIcon, XIcon, EditIcon, CheckIcon, XCircleIcon, PanelLeft } from 'lucide-react';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Source {
  id: string;
  title: string;
  content: string;
}

const NotesView = () => {
  const { noteId } = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const { notes, updateNote } = useNotesStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Find the current note
  const currentNote = notes.find(note => note.id === noteId);
  
  // Title and subheading editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(currentNote?.title || '');
  const [editedSubheading, setEditedSubheading] = useState(currentNote?.subheading || '');
  
  // Sources panel state
  const [isSourcesPanelOpen, setIsSourcesPanelOpen] = useState(true);
  
  // Sources state
  const [sources, setSources] = useState<Source[]>([
    {
      id: '1',
      title: 'Sample Source',
      content: 'This is a sample source with some content to demonstrate the sources panel.'
    }
  ]);
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Hello! I\'m here to help you with your notes. What would you like to discuss?',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);

  // Update edited values when currentNote changes
  useEffect(() => {
    if (currentNote) {
      setEditedTitle(currentNote.title);
      setEditedSubheading(currentNote.subheading || '');
    }
  }, [currentNote]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 120; // ~5 lines
      textareaRef.current.style.height = Math.min(scrollHeight, maxHeight) + 'px';
    }
  }, [inputMessage]);

  // Scroll to bottom function
  const scrollToBottom = (smooth = true) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  };

  // Check if user is at bottom of chat
  const checkIfAtBottom = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
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
        subheading: editedSubheading
      });
    }
    setIsEditingTitle(false);
  };

  // Cancel title editing
  const handleCancelTitleEdit = () => {
    setEditedTitle(currentNote?.title || '');
    setEditedSubheading(currentNote?.subheading || '');
    setIsEditingTitle(false);
  };

  // Generate random lorem ipsum
  const generateLoremIpsum = () => {
    const sentences = [
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
      "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
      "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.",
      "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.",
      "Nulla pariatur excepteur sint occaecat cupidatat non proident.",
      "At vero eos et accusamus et iusto odio dignissimos ducimus.",
      "Et harum quidem rerum facilis est et expedita distinctio.",
      "Nam libero tempore, cum soluta nobis est eligendi optio cumque.",
      "Nihil impedit quo minus id quod maxime placeat facere possimus."
    ];
    
    const numSentences = Math.floor(Math.random() * 4) + 1; // 1-4 sentences
    const selectedSentences = [];
    
    for (let i = 0; i < numSentences; i++) {
      const randomIndex = Math.floor(Math.random() * sentences.length);
      selectedSentences.push(sentences[randomIndex]);
    }
    
    return selectedSentences.join(' ');
  };

  // Add new source
  const handleAddSource = () => {
    const sourceTexts = [
      "Research findings about artificial intelligence and machine learning applications.",
      "Meeting notes from the quarterly review discussing project milestones and goals.",
      "Technical documentation explaining the implementation details of the new feature.",
      "Customer feedback and user experience insights from recent survey results.",
      "Market analysis and competitive landscape overview for strategic planning."
    ];
    
    const randomText = sourceTexts[Math.floor(Math.random() * sourceTexts.length)];
    const newSource: Source = {
      id: Date.now().toString(),
      title: `Source ${sources.length + 1}`,
      content: randomText
    };
    
    setSources(prev => [...prev, newSource]);
  };

  // Remove source
  const handleRemoveSource = (sourceId: string) => {
    setSources(prev => prev.filter(source => source.id !== sourceId));
  };

  // Handle sending message
  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    
    // Smooth scroll to bottom after sending message
    setTimeout(() => scrollToBottom(true), 100);
    
    // Simulate assistant response after a brief delay
    setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: generateLoremIpsum(),
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      // Smooth scroll to bottom after assistant response
      setTimeout(() => scrollToBottom(true), 100);
    }, 1000);
  };

  // Handle key press in input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!currentNote) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Note not found</h2>
          <button
            onClick={() => navigate('/')}
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
            onClick={() => navigate('/')}
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
                  <h1 className="text-xl font-semibold text-gray-900">{currentNote.title}</h1>
                  <button
                    onClick={() => setIsEditingTitle(true)}
                    className="p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <EditIcon size={16} />
                  </button>
                </div>
                {currentNote.subheading && (
                  <p className="text-sm text-gray-600">{currentNote.subheading}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Sources Panel */}
        <div className={`bg-white border-r border-gray-200 flex flex-col h-full transition-all duration-300 ${
          isSourcesPanelOpen ? 'w-1/3' : 'w-12'
        }`}>
          <div className="p-4 border-b border-gray-200 flex-shrink-0">
            <div className={`flex items-center ${isSourcesPanelOpen ? 'justify-between' : 'justify-center'}`}>
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
              {/* Add Source Button */}
              <button
                onClick={handleAddSource}
                className="w-full flex items-center justify-center gap-2 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-full border border-blue-200 transition-colors mb-3"
              >
                <PlusIcon size={16} />
                Add Source
              </button>
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors cursor-pointer group relative"
                >
                  <button
                    onClick={() => handleRemoveSource(source.id)}
                    className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <XIcon size={14} />
                  </button>
                  <h3 className="font-medium text-gray-900 text-sm mb-1 pr-6">{source.title}</h3>
                  <p className="text-xs text-gray-600 line-clamp-3">{source.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat Panel */}
        <div className={`${isSourcesPanelOpen ? 'w-2/3' : 'flex-1'} flex flex-col h-full relative`}>
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
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-900'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className={`text-xs mt-1 ${
                    message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none overflow-hidden"
                rows={1}
                style={{ minHeight: '40px', maxHeight: '120px' }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center h-10"
              >
                <SendIcon size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotesView; 