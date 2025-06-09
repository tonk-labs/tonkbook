import { create } from 'zustand';

/**
 * UI state interface for local client preferences and feedback
 * This state is NOT synced across clients
 */
interface UIState {
  /** Current view mode for notes display */
  notesViewMode: 'grid' | 'list';
  /** Loading state for notes */
  notesLoading: boolean;
  /** Error state for UI feedback */
  error: {
    hasError: boolean;
    message: string;
    type: 'error' | 'warning' | 'info';
  };
}

/**
 * UI actions interface for managing local UI state
 */
interface UIActions {
  /** Set the notes view mode */
  setNotesViewMode: (mode: 'grid' | 'list') => void;
  /** Set the notes loading state */
  setNotesLoading: (loading: boolean) => void;
  /** Show an error message to the user */
  showError: (message: string, type?: 'error' | 'warning' | 'info') => void;
  /** Clear any displayed error */
  clearError: () => void;
}

type UIStore = UIState & UIActions;

/**
 * Local UI store for client-specific preferences and feedback
 * This store is NOT synced and maintains local UI state
 */
export const useUIStore = create<UIStore>((set) => ({
  // Initial UI state
  notesViewMode: 'grid',
  notesLoading: false,
  error: {
    hasError: false,
    message: '',
    type: 'error',
  },

  // UI actions
  setNotesViewMode: (mode: 'grid' | 'list') => {
    set({ notesViewMode: mode });
  },

  setNotesLoading: (loading: boolean) => {
    set({ notesLoading: loading });
  },

  showError: (message: string, type: 'error' | 'warning' | 'info' = 'error') => {
    set({
      error: {
        hasError: true,
        message,
        type,
      },
    });
  },

  clearError: () => {
    set({
      error: {
        hasError: false,
        message: '',
        type: 'error',
      },
    });
  },
})); 