import React, { useState, useEffect } from 'react';
import { readDoc, writeDoc } from '@tonk/keepsync';
import { Source } from '../../types/source';

interface SourceContent {
  title: string;
  content: string;
  metadata: {
    type: string;
    createdAt: Date;
  };
}

interface ViewSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  source: Source | null;
  onUpdateSource?: (id: string, updates: Partial<Pick<Source, 'title' | 'path'>>) => boolean;
}

const ViewSourceModal: React.FC<ViewSourceModalProps> = ({
  isOpen,
  onClose,
  source,
  onUpdateSource,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
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
      const sourceData = await readDoc<SourceContent>(source.path);
      if (sourceData) {
        setTitle(sourceData.title);
        setContent(sourceData.content);
      } else {
        setError('Source content not found');
      }
    } catch (err) {
      setError('Failed to load source content');
      console.error('Error loading source content:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!source || !title.trim() || !content.trim()) return;

    try {
      setIsSaving(true);
      const trimmedTitle = title.trim();
      const trimmedContent = content.trim();
      
      const updatedContent: SourceContent = {
        title: trimmedTitle,
        content: trimmedContent,
        metadata: {
          type: 'text',
          createdAt: new Date(),
        },
      };

      // Save content to keepsync
      await writeDoc(source.path, updatedContent);
      
      // Update the source title in the store if it changed
      if (trimmedTitle !== source.title && onUpdateSource) {
        onUpdateSource(source.id, { title: trimmedTitle });
      }
      
      setIsEditing(false);
    } catch (err) {
      setError('Failed to save changes');
      console.error('Error saving source content:', err);
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
    setTitle('');
    setContent('');
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
              {isEditing ? 'Edit Source' : 'View Source'}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Path: {source.path}
            </p>
          </div>
          <div className="flex gap-2">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                Edit
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
              disabled={!title.trim() || !content.trim() || isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewSourceModal;