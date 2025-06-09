import { create } from 'zustand';
import { sync, DocumentId } from '@tonk/keepsync';
import { v4 as uuidv4 } from 'uuid';

export interface Note {
  id: string;
  title: string;
  subheading: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * State interface for notes data management
 * Focused purely on notes data, no UI concerns
 */
interface NotesState {
  /** Array of all notes */
  notes: Note[];
}

/**
 * Actions interface for notes data management
 * Each action represents a specific way to modify notes data
 */
interface NotesActions {
  /** Add a new note and return its ID, or null if failed */
  addNote: (title: string, subheading: string) => string | null;
  /** Remove a note by ID, returns success status */
  deleteNote: (id: string) => boolean;
  /** Update an existing note's title or subheading, returns success status */
  updateNote: (id: string, updates: Partial<Pick<Note, 'title' | 'subheading'>>) => boolean;
}

type NotesStore = NotesState & NotesActions;

export const useNotesStore = create<NotesStore>(
  sync(
    (set, get) => ({
      // Initial state - focused purely on notes data
      notes: [],

      // Data management actions
      addNote: (title: string, subheading: string) => {
        // Simple validation - return null for invalid input
        if (!title?.trim() || !subheading?.trim()) {
          return null;
        }

        const id = uuidv4();
        const now = new Date();
        
        const newNote: Note = {
          id,
          title: title.trim(),
          subheading: subheading.trim(),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };

        set((state) => ({
          notes: [...state.notes, newNote],
        }));
        
        return id;
      },

      deleteNote: (id: string) => {
        // Simple validation
        if (!id) {
          return false;
        }

        const noteExists = get().notes.some(note => note.id === id);
        if (!noteExists) {
          return false;
        }

        set((state) => ({
          notes: state.notes.filter(note => note.id !== id),
        }));
        
        return true;
      },

      updateNote: (id: string, updates: Partial<Pick<Note, 'title' | 'subheading'>>) => {
        // Simple validation
        if (!id || !updates || Object.keys(updates).length === 0) {
          return false;
        }

        const noteExists = get().notes.some(note => note.id === id);
        if (!noteExists) {
          return false;
        }

        // Clean up updates
        const cleanUpdates: Partial<Pick<Note, 'title' | 'subheading'>> = {};
        if (updates.title !== undefined) {
          cleanUpdates.title = updates.title.trim();
        }
        if (updates.subheading !== undefined) {
          cleanUpdates.subheading = updates.subheading.trim();
        }

        set((state) => ({
          notes: state.notes.map(note => 
            note.id === id 
              ? { ...note, ...cleanUpdates, updatedAt: new Date().toISOString() }
              : note
          ),
        }));
        
        return true;
      },
    }),
    {
      docId: '/tonkbook/notes' as DocumentId,
      initTimeout: 30000,
      onInitError: (error) => console.error('Notes store sync initialization error:', error),
    }
  )
); 