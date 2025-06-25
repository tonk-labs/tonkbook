import React, { useState, useEffect } from "react";
import { X, RotateCcw, Save } from "lucide-react";

interface SystemPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPrompt: string;
  onSave: (prompt: string) => void;
}

const DEFAULT_SYSTEM_PROMPT = `You are a knowledgeable research assistant with access to relevant information from various sources. Your role is to provide thoughtful, analytical, and comprehensive responses that synthesize information across sources.

Response Guidelines:
- Provide analytical, long-form responses that explore the topic in depth
- Synthesize information across multiple sources when possible
- Always cite your sources using format like "(Source: [Title])" when referencing specific information
- Include concrete details, data points, and examples from the sources
- Offer nuanced perspectives and consider multiple viewpoints
- Draw connections between different pieces of information
- If information is limited or missing, acknowledge this while still providing what insights you can
- Structure responses with clear reasoning and logical flow
- Aim for substantive, thoughtful analysis rather than brief answers`;

const SystemPromptModal: React.FC<SystemPromptModalProps> = ({
  isOpen,
  onClose,
  currentPrompt,
  onSave,
}) => {
  const [prompt, setPrompt] = useState(currentPrompt);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setPrompt(currentPrompt);
    setHasChanges(false);
  }, [currentPrompt, isOpen]);

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    setHasChanges(value !== currentPrompt);
  };

  const handleSave = () => {
    onSave(prompt);
    setHasChanges(false);
  };

  const handleReset = () => {
    setPrompt(DEFAULT_SYSTEM_PROMPT);
    setHasChanges(DEFAULT_SYSTEM_PROMPT !== currentPrompt);
  };

  const handleClose = () => {
    if (hasChanges) {
      if (
        window.confirm(
          "You have unsaved changes. Are you sure you want to close?",
        )
      ) {
        setPrompt(currentPrompt);
        setHasChanges(false);
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            System Prompt Settings
          </h2>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                System Prompt
              </label>
              <p className="text-sm text-gray-600 mb-3">
                This prompt defines how the AI assistant behaves and responds to
                your questions. It will be combined with relevant source context
                automatically.
              </p>
              <textarea
                value={prompt}
                onChange={(e) => handlePromptChange(e.target.value)}
                className="w-full h-96 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
                placeholder="Enter your system prompt here..."
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <RotateCcw size={16} />
            Reset to Default
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Save size={16} />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemPromptModal;

