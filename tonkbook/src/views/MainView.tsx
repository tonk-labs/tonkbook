import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotesStore } from '../stores/notesStore';
import { useUIStore } from '../stores/uiStore';
import { PlusIcon, GridIcon, ListIcon, TrashIcon } from 'lucide-react';

const MainView = () => {
  const navigate = useNavigate();
  const { notes, addNote, deleteNote } = useNotesStore();
  const { notesViewMode, setNotesViewMode, error, showError, clearError } = useUIStore();
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleAddNote = () => {
    try {
      // Create note with sane defaults and get the generated ID
      const noteId = addNote('Untitled', 'A new tonkbook');
      
      if (noteId) {
        // Navigate to the notes view for the new note
        navigate(`/notes/${noteId}`);
      } else {
        // Show user-friendly error message
        showError('Unable to create note. Please check that title and description are provided.');
      }
    } catch (error) {
      console.error('Error creating note:', error);
      showError('An unexpected error occurred while creating the note.');
    }
  };

  const goToNote = (note) => {
    navigate(`/notes/${note.id}`)
  }

  const handleDeleteNote = (id: string) => {
    try {
      const success = deleteNote(id);
      if (success) {
        setDeleteConfirmId(null);
      } else {
        // Show user-friendly error message
        showError('Unable to delete note. The note may not exist.');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      showError('An unexpected error occurred while deleting the note.');
    }
  };

  const formatDate = (date: string | null | undefined) => {
    // Handle null/undefined dates
    if (!date) {
      return 'No date';
    }
    
    try {
      // Convert ISO string to Date object
      const dateObj = new Date(date);
      
      // Check if the date is valid
      if (isNaN(dateObj.getTime())) {
        console.warn('Invalid date value:', date);
        return 'Invalid date';
      }
      
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(dateObj);
    } catch (error) {
      console.error('Error formatting date:', error, 'Date value:', date);
      return 'Date error';
    }
  };

  return (
    <main className="p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Error/Info Display */}
        {error.hasError && (
          <div className={`mb-6 rounded-lg p-4 flex items-center justify-between ${
            error.type === 'error' ? 'bg-red-50 border border-red-200' :
            error.type === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
            'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex items-center">
              <div className={`mr-3 ${
                error.type === 'error' ? 'text-red-600' :
                error.type === 'warning' ? 'text-yellow-600' :
                'text-blue-600'
              }`}>
                {error.type === 'error' ? '⚠️' : error.type === 'warning' ? '⚠️' : 'ℹ️'}
              </div>
              <div>
                <p className={`font-medium ${
                  error.type === 'error' ? 'text-red-800' :
                  error.type === 'warning' ? 'text-yellow-800' :
                  'text-blue-800'
                }`}>
                  {error.type === 'error' ? 'Error' : error.type === 'warning' ? 'Warning' : 'Info'}
                </p>
                <p className={`text-sm ${
                  error.type === 'error' ? 'text-red-700' :
                  error.type === 'warning' ? 'text-yellow-700' :
                  'text-blue-700'
                }`}>
                  {error.message}
                </p>
              </div>
            </div>
            <button
              onClick={clearError}
              className={`p-1 ${
                error.type === 'error' ? 'text-red-500 hover:text-red-700' :
                error.type === 'warning' ? 'text-yellow-500 hover:text-yellow-700' :
                'text-blue-500 hover:text-blue-700'
              }`}
              aria-label="Dismiss message"
            >
              ✕
            </button>
          </div>
        )}
        
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
              onClick={handleAddNote}
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
              onClick={handleAddNote}
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
                
                <div 
                  className={`cursor-pointer ${notesViewMode === 'list' ? 'flex-1 min-w-0' : ''}`} 
                  onClick={goToNote.bind(this, note)}
                >
                  {notesViewMode === 'list' ? (
                    // Horizontal layout for list view
                    <div className="flex items-center justify-between pr-8">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {note.title}
                        </h3>
                        {note.subheading && (
                          <p className="text-gray-600 text-sm truncate">
                            {note.subheading}
                          </p>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 flex-shrink-0 ml-4">
                        Created {formatDate(note.createdAt)}
                        {(() => {
                          try {
                            if (!note.createdAt || !note.updatedAt) return false;
                            
                            const createdDate = new Date(note.createdAt);
                            const updatedDate = new Date(note.updatedAt);
                            
                            // Validate both dates
                            if (isNaN(createdDate.getTime()) || isNaN(updatedDate.getTime())) {
                              return false;
                            }
                            
                            return updatedDate.getTime() !== createdDate.getTime();
                          } catch (error) {
                            console.error('Error comparing dates:', error);
                            return false;
                          }
                        })() && (
                          <span> • Updated {formatDate(note.updatedAt)}</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Vertical layout for grid view
                    <>
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
                        {(() => {
                          try {
                            if (!note.createdAt || !note.updatedAt) return false;
                            
                            const createdDate = new Date(note.createdAt);
                            const updatedDate = new Date(note.updatedAt);
                            
                            // Validate both dates
                            if (isNaN(createdDate.getTime()) || isNaN(updatedDate.getTime())) {
                              return false;
                            }
                            
                            return updatedDate.getTime() !== createdDate.getTime();
                          } catch (error) {
                            console.error('Error comparing dates:', error);
                            return false;
                          }
                        })() && (
                          <span> • Updated {formatDate(note.updatedAt)}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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