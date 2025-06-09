import { create } from 'zustand';

/**
 * UI state interface for local client preferences
 * This state is NOT synced across clients
 */
interface UIState {
  /** Current view mode for notes display */
  notesViewMode: 'grid' | 'list';
  /** Loading state for notes */
  notesLoading: boolean;
  /** Set the notes view mode */
  setNotesViewMode: (mode: 'grid' | 'list') => void;
  /** Set the notes loading state */
  setNotesLoading: (loading: boolean) => void;
}

/**
 * Local UI store for client-specific preferences
 * This store is NOT synced and maintains local UI state
 */
export const useUIStore = create<UIState>((set) => ({
  // Initial UI state
  notesViewMode: 'grid',
  notesLoading: false,

  // UI actions
  setNotesViewMode: (mode: 'grid' | 'list') => {
    set({ notesViewMode: mode });
  },

  setNotesLoading: (loading: boolean) => {
    set({ notesLoading: loading });
  },
})); 