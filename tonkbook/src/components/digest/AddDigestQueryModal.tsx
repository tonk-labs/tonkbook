import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { DigestQuery } from '../../types/digest';

interface AddDigestQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (title: string, query: string, options?: Partial<DigestQuery>) => void;
}

const AddDigestQueryModal: React.FC<AddDigestQueryModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const [form, setForm] = useState({
    title: '',
    query: '',
    priority: 'medium' as const,
    sources: 'both' as const,
    maxResults: 5,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!form.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!form.query.trim()) {
      newErrors.query = 'Query is required';
    }
    
    if (form.maxResults < 1 || form.maxResults > 20) {
      newErrors.maxResults = 'Max results must be between 1 and 20';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    onAdd(form.title.trim(), form.query.trim(), {
      priority: form.priority,
      sources: form.sources,
      maxResults: form.maxResults,
    });
    
    handleClose();
  };

  const handleClose = () => {
    setForm({
      title: '',
      query: '',
      priority: 'medium',
      sources: 'both',
      maxResults: 5,
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Add New Digest Query
            </h3>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Query Title *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.title ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="e.g., AI News, Tech Updates, Market Trends..."
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Query *
              </label>
              <textarea
                value={form.query}
                onChange={(e) => setForm({ ...form, query: e.target.value })}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.query ? 'border-red-300' : 'border-gray-300'
                }`}
                rows={3}
                placeholder="Enter search terms or keywords for this topic..."
              />
              {errors.query && (
                <p className="mt-1 text-sm text-red-600">{errors.query}</p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                This will be used to search for relevant content each day
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Higher priority queries are processed first
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Sources
                </label>
                <select
                  value={form.sources}
                  onChange={(e) => setForm({ ...form, sources: e.target.value as any })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="both">Web + RAG</option>
                  <option value="web">Web Only</option>
                  <option value="rag">RAG Only</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Choose which sources to search
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Results
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={form.maxResults}
                  onChange={(e) => setForm({ ...form, maxResults: parseInt(e.target.value) })}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.maxResults ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.maxResults && (
                  <p className="mt-1 text-xs text-red-600">{errors.maxResults}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Number of items to include per query
                </p>
              </div>
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Add Query
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddDigestQueryModal;