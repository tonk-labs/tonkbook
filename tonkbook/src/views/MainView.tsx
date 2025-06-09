import React, { useEffect, useState } from 'react';
import { useNotesStore } from '../stores/notesStore';
import { useUIStore } from '../stores/uiStore';
import { PlusIcon, GridIcon, ListIcon, TrashIcon } from 'lucide-react';

const MainView = () => {
  const { notes, addNote, deleteNote } = useNotesStore();
  const { notesViewMode, setNotesViewMode } = useUIStore();
  
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteSubheading, setNewNoteSubheading] = useState('');

  const handleAddNote = () => {
    if (newNoteTitle.trim()) {
      addNote(newNoteTitle.trim(), newNoteSubheading.trim());
      setNewNoteTitle('');
      setNewNoteSubheading('');
      setShowAddNoteModal(false);
    }
  };

  const handleDeleteNote = (id: string) => {
    deleteNote(id);
    setDeleteConfirmId(null);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Notes</h1>
            <p className="text-gray-600 mt-1">
              {notes.length === 0 ? 'No notes yet' : `${notes.length} note${notes.length === 1 ? '' : 's'}`}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* View Toggle */}
            <div className="flex bg-white rounded-lg shadow-sm border p-1">
              <button
                onClick={() => setNotesViewMode('grid')}
                className={`p-2 rounded transition-colors ${
                  notesViewMode === 'grid' 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <GridIcon size={20} />
              </button>
              <button
                onClick={() => setNotesViewMode('list')}
                className={`p-2 rounded transition-colors ${
                  notesViewMode === 'list' 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <ListIcon size={20} />
              </button>
            </div>
            
            {/* Add Note Button */}
            <button
              onClick={() => setShowAddNoteModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon size={20} />
              Add Note
            </button>
          </div>
        </div>

        {/* Notes Grid/List */}
        {notes.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <GridIcon size={48} className="mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No notes yet</h3>
            <p className="text-gray-600 mb-4">Get started by creating your first note</p>
            <button
              onClick={() => setShowAddNoteModal(true)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon size={20} />
              Add Your First Note
            </button>
          </div>
        ) : (
          <div className={
            notesViewMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' 
              : 'space-y-4'
          }>
            {notes.map((note) => (
              <div
                key={note.id}
                className={`bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow relative group ${
                  notesViewMode === 'list' ? 'flex items-start p-4' : 'p-6'
                }`}
              >
                <button
                  onClick={() => setDeleteConfirmId(note.id)}
                  className="absolute top-3 right-3 p-1 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <TrashIcon size={16} />
                </button>
                
                <div className={notesViewMode === 'list' ? 'flex-1 min-w-0' : ''}>
                  <h3 className="font-semibold text-gray-900 mb-2 pr-8">
                    {note.title}
                  </h3>
                  {note.subheading && (
                    <p className="text-gray-600 text-sm mb-3">
                      {note.subheading}
                    </p>
                  )}
                  <div className="text-xs text-gray-400">
                    Created {formatDate(note.createdAt)}
                    {note.updatedAt.getTime() !== note.createdAt.getTime() && (
                      <span> • Updated {formatDate(note.updatedAt)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Note Modal */}
      {showAddNoteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Add New Note</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter note title"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subheading
                </label>
                <input
                  type="text"
                  value={newNoteSubheading}
                  onChange={(e) => setNewNoteSubheading(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter subheading (optional)"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddNoteModal(false);
                  setNewNoteTitle('');
                  setNewNoteSubheading('');
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNote}
                disabled={!newNoteTitle.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Add Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete Note</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this note? This action cannot be undone.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteNote(deleteConfirmId)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default MainView; 