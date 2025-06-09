import { create } from 'zustand';
import { sync, DocumentId } from '@tonk/keepsync';
import { v4 as uuidv4 } from 'uuid';

export interface Note {
  id: string;
  title: string;
  subheading: string;
  createdAt: Date;
  updatedAt: Date;
}

interface NotesState {
  notes: Note[];
  addNote: (title: string, subheading: string) => void;
  deleteNote: (id: string) => void;
  updateNote: (id: string, updates: Partial<Pick<Note, 'title' | 'subheading'>>) => void;
}

export const useNotesStore = create<NotesState>(
  sync(
    (set, get) => ({
      notes: [],

      addNote: (title: string, subheading: string) => {
        const id = uuidv4();
        const now = new Date();
        
        const newNote: Note = {
          id,
          title,
          subheading,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          notes: [...state.notes, newNote],
        }));
      },

      deleteNote: (id: string) => {
        set((state) => ({
          notes: state.notes.filter(note => note.id !== id),
        }));
      },

      updateNote: (id: string, updates: Partial<Pick<Note, 'title' | 'subheading'>>) => {
        set((state) => ({
          notes: state.notes.map(note => 
            note.id === id 
              ? { ...note, ...updates, updatedAt: new Date() }
              : note
          ),
        }));
      },
    }),
    {
      docId: '/tonkbook/notes' as DocumentId,
      initTimeout: 30000,
      onInitError: (error) => console.error('Notes store sync initialization error:', error),
    }
  )
); 