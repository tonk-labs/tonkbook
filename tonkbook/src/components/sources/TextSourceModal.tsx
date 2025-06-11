import React, { useState } from "react";
import { Source } from "../../types/source";
import { writeDoc } from "@tonk/keepsync";

interface TextSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSource: (source: Omit<Source, "id" | "noteId">) => void;
}

const TextSourceModal: React.FC<TextSourceModalProps> = ({
  isOpen,
  onClose,
  onAddSource,
}) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    const sourcePath = `tonkbook/data/${trimmedTitle}`;

    // Create the source content document
    const sourceContent = {
      title: trimmedTitle,
      content: trimmedContent,
      metadata: {
        type: "text",
        createdAt: new Date().toISOString(),
      },
    };

    // Write the content to keepsync
    await writeDoc(sourcePath, sourceContent);

    // Create the source reference for the store
    const sourceReference: Omit<Source, "id" | "noteId"> = {
      title: trimmedTitle,
      path: sourcePath,
      metadata: {
        type: "text",
        createdAt: new Date().toISOString(),
      },
    };

    onAddSource(sourceReference);
    setTitle("");
    setContent("");
    onClose();
  };

  const handleCancel = () => {
    setTitle("");
    setContent("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Text Source</h3>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title for your text source"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter your text content here..."
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !content.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Add Text Source
          </button>
        </div>
      </div>
    </div>
  );
};

export default TextSourceModal;
