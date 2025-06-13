import React, { useState } from 'react';
import { Search, Edit2, Trash2, ToggleLeft, ToggleRight, Settings } from 'lucide-react';
import { DigestQuery } from '../../types/digest';

interface DigestQueryCardProps {
  query: DigestQuery;
  onUpdate: (id: string, updates: Partial<DigestQuery>) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}

const DigestQueryCard: React.FC<DigestQueryCardProps> = ({
  query,
  onUpdate,
  onDelete,
  onToggle,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: query.title,
    query: query.query,
    priority: query.priority,
    sources: query.sources,
    maxResults: query.maxResults,
  });

  const handleSave = () => {
    onUpdate(query.id, editForm);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditForm({
      title: query.title,
      query: query.query,
      priority: query.priority,
      sources: query.sources,
      maxResults: query.maxResults,
    });
    setIsEditing(false);
  };

  const priorityColors = {
    high: 'bg-red-100 text-red-800 border-red-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  const sourceColors = {
    web: 'bg-green-100 text-green-800',
    rag: 'bg-purple-100 text-purple-800',
    both: 'bg-indigo-100 text-indigo-800',
  };

  if (isEditing) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-blue-50">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Query title..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Query
            </label>
            <textarea
              value={editForm.query}
              onChange={(e) => setEditForm({ ...editForm, query: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              placeholder="Search terms..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={editForm.priority}
                onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sources
              </label>
              <select
                value={editForm.sources}
                onChange={(e) => setEditForm({ ...editForm, sources: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="both">Both</option>
                <option value="web">Web Only</option>
                <option value="rag">RAG Only</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Results
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={editForm.maxResults}
                onChange={(e) => setEditForm({ ...editForm, maxResults: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`border border-gray-200 rounded-lg p-4 transition-all ${
      query.enabled ? 'bg-white' : 'bg-gray-50 opacity-70'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {query.title}
          </h3>
          <p className="text-gray-600 text-sm mb-3">
            {query.query}
          </p>
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => onToggle(query.id)}
            className="p-1 hover:bg-gray-100 rounded"
            title={query.enabled ? 'Disable query' : 'Enable query'}
          >
            {query.enabled ? (
              <ToggleRight className="w-5 h-5 text-green-600" />
            ) : (
              <ToggleLeft className="w-5 h-5 text-gray-400" />
            )}
          </button>
          
          <button
            onClick={() => setIsEditing(true)}
            className="p-1 hover:bg-gray-100 rounded"
            title="Edit query"
          >
            <Edit2 className="w-4 h-4 text-gray-600" />
          </button>
          
          <button
            onClick={() => onDelete(query.id)}
            className="p-1 hover:bg-gray-100 rounded"
            title="Delete query"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className={`px-2 py-1 rounded-full font-medium ${priorityColors[query.priority]}`}>
          {query.priority}
        </span>
        
        <span className={`px-2 py-1 rounded-full font-medium ${sourceColors[query.sources]}`}>
          {query.sources === 'both' ? 'Web + RAG' : query.sources.toUpperCase()}
        </span>
        
        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full font-medium">
          Max {query.maxResults}
        </span>
        
        <span className="text-gray-500 ml-auto">
          Updated {new Date(query.updatedAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
};

export default DigestQueryCard;