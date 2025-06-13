import { create } from 'zustand';
import { sync, DocumentId } from '@tonk/keepsync';
import { v4 as uuidv4 } from 'uuid';
import { DigestQuery, DailyDigest, DigestConfig } from '../types/digest';

interface DigestState {
  queries: DigestQuery[];
  digests: DailyDigest[];
  config: DigestConfig;
}

interface DigestActions {
  addQuery: (title: string, query: string, options?: Partial<DigestQuery>) => string | null;
  updateQuery: (id: string, updates: Partial<DigestQuery>) => boolean;
  deleteQuery: (id: string) => boolean;
  toggleQuery: (id: string) => boolean;
  updateConfig: (updates: Partial<DigestConfig>) => void;
  addDigest: (digest: DailyDigest) => void;
  getTodaysDigest: () => DailyDigest | null;
  getDigestByDate: (date: string) => DailyDigest | null;
  cleanupOldDigests: () => void;
}

type DigestStore = DigestState & DigestActions;

const defaultConfig: DigestConfig = {
  enabled: true,
  generateTime: "08:00",
  maxItemsPerQuery: 5,
  maxTotalItems: 25,
  enableAISummary: true,
  retentionDays: 30,
};

export const useDigestStore = create<DigestStore>(
  sync(
    (set, get) => ({
      queries: [],
      digests: [],
      config: defaultConfig,

      addQuery: (title: string, query: string, options = {}) => {
        if (!title?.trim() || !query?.trim()) {
          return null;
        }

        const id = uuidv4();
        const now = new Date();
        
        const newQuery: DigestQuery = {
          id,
          title: title.trim(),
          query: query.trim(),
          priority: options.priority || "medium",
          sources: options.sources || "both",
          maxResults: options.maxResults || 5,
          enabled: options.enabled !== undefined ? options.enabled : true,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };

        set((state) => ({
          queries: [...state.queries, newQuery],
        }));
        
        return id;
      },

      updateQuery: (id: string, updates: Partial<DigestQuery>) => {
        if (!id || !updates || Object.keys(updates).length === 0) {
          return false;
        }

        const queryExists = get().queries.some(query => query.id === id);
        if (!queryExists) {
          return false;
        }

        const cleanUpdates = {
          ...updates,
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          queries: state.queries.map(query => 
            query.id === id 
              ? { ...query, ...cleanUpdates }
              : query
          ),
        }));
        
        return true;
      },

      deleteQuery: (id: string) => {
        if (!id) {
          return false;
        }

        const queryExists = get().queries.some(query => query.id === id);
        if (!queryExists) {
          return false;
        }

        set((state) => ({
          queries: state.queries.filter(query => query.id !== id),
        }));
        
        return true;
      },

      toggleQuery: (id: string) => {
        const query = get().queries.find(q => q.id === id);
        if (!query) {
          return false;
        }

        return get().updateQuery(id, { enabled: !query.enabled });
      },

      updateConfig: (updates: Partial<DigestConfig>) => {
        set((state) => ({
          config: { ...state.config, ...updates },
        }));
      },

      addDigest: (digest: DailyDigest) => {
        set((state) => {
          const existingIndex = state.digests.findIndex(d => d.date === digest.date);
          if (existingIndex >= 0) {
            const newDigests = [...state.digests];
            newDigests[existingIndex] = digest;
            return { digests: newDigests };
          } else {
            return { digests: [...state.digests, digest] };
          }
        });
      },

      getTodaysDigest: () => {
        const today = new Date().toISOString().split('T')[0];
        return get().getDigestByDate(today);
      },

      getDigestByDate: (date: string) => {
        return get().digests.find(digest => digest.date === date) || null;
      },

      cleanupOldDigests: () => {
        const retentionDays = get().config.retentionDays;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

        set((state) => ({
          digests: state.digests.filter(digest => digest.date >= cutoffDateStr),
        }));
      },
    }),
    {
      docId: '/tonkbook/digests' as DocumentId,
      initTimeout: 30000,
      onInitError: (error) => console.error('Digest store sync initialization error:', error),
    }
  )
);