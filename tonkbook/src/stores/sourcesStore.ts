import { create } from 'zustand';
import { sync, DocumentId } from '@tonk/keepsync';
import { v4 as uuidv4 } from 'uuid';
import { Source } from '../types/source';

/**
 * State interface for sources data management
 * Focused purely on sources data, no UI concerns
 */
interface SourcesState {
  /** Array of all sources */
  sources: Source[];
}

/**
 * Actions interface for sources data management
 * Each action represents a specific way to modify sources data
 */
interface SourcesActions {
  /** Add a new source and return its ID, or null if failed */
  addSource: (sourceData: Omit<Source, 'id'>) => string | null;
  /** Remove a source by ID, returns success status */
  removeSource: (id: string) => boolean;
  /** Update an existing source's title or path, returns success status */
  updateSource: (id: string, updates: Partial<Pick<Source, 'title' | 'path'>>) => boolean;
  /** Get sources filtered by noteId */
  getSourcesByNoteId: (noteId: string) => Source[];
}

type SourcesStore = SourcesState & SourcesActions;

export const useSourcesStore = create<SourcesStore>(
  sync(
    (set, get) => ({
      // Initial state - focused purely on sources data
      sources: [],

      // Data management actions
      addSource: (sourceData: Omit<Source, 'id'>) => {
        // Simple validation - return null for invalid input
        if (!sourceData.title?.trim() || !sourceData.path?.trim() || !sourceData.noteId?.trim()) {
          return null;
        }

        const id = uuidv4();
        
        const newSource: Source = {
          ...sourceData,
          id,
          title: sourceData.title.trim(),
          path: sourceData.path.trim(),
          noteId: sourceData.noteId.trim(),
        };

        set((state) => ({
          sources: [...state.sources, newSource],
        }));
        
        return id;
      },

      removeSource: (id: string) => {
        // Simple validation
        if (!id) {
          return false;
        }

        const sourceExists = get().sources.some(source => source.id === id);
        if (!sourceExists) {
          return false;
        }

        set((state) => ({
          sources: state.sources.filter(source => source.id !== id),
        }));
        
        return true;
      },

      updateSource: (id: string, updates: Partial<Pick<Source, 'title' | 'path'>>) => {
        // Simple validation
        if (!id || !updates || Object.keys(updates).length === 0) {
          return false;
        }

        const sourceExists = get().sources.some(source => source.id === id);
        if (!sourceExists) {
          return false;
        }

        // Clean up updates
        const cleanUpdates: Partial<Pick<Source, 'title' | 'path'>> = {};
        if (updates.title !== undefined) {
          cleanUpdates.title = updates.title.trim();
        }
        if (updates.path !== undefined) {
          cleanUpdates.path = updates.path.trim();
        }

        set((state) => ({
          sources: state.sources.map(source => 
            source.id === id 
              ? { ...source, ...cleanUpdates }
              : source
          ),
        }));
        
        return true;
      },

      getSourcesByNoteId: (noteId: string) => {
        if (!noteId) {
          return [];
        }
        return get().sources.filter(source => source.noteId === noteId);
      },

    }),
    {
      docId: '/tonkbook/sources' as DocumentId,
      initTimeout: 30000,
      onInitError: (error) => console.error('Sources store sync initialization error:', error),
    }
  )
);