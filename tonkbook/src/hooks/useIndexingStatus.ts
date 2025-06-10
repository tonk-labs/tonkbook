import { useState, useEffect, useCallback } from 'react';
import { indexingStatusService, IndexingStatus, IndexingStatusError } from '../services/indexingStatusService';

export function useIndexingStatus(refreshInterval: number = 5000) {
  const [status, setStatus] = useState<IndexingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const result = await indexingStatusService.getStatus();
      
      if ('error' in result) {
        setError(result.error);
        setStatus(null);
      } else {
        setStatus(result);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    
    const interval = setInterval(fetchStatus, refreshInterval);
    
    return () => clearInterval(interval);
  }, [fetchStatus, refreshInterval]);

  return {
    status,
    error,
    isLoading,
    refresh: fetchStatus
  };
}