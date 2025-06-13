import React, { useState, useEffect } from 'react';
import { Plus, Play, Settings, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useDigestStore } from '../stores/digestStore';
import { digestService } from '../services/digestService';
import DigestQueryCard from '../components/digest/DigestQueryCard';
import AddDigestQueryModal from '../components/digest/AddDigestQueryModal';
import DigestCard from '../components/digest/DigestCard';
import { DailyDigest } from '../types/digest';

const DigestView: React.FC = () => {
  const {
    queries,
    digests,
    config,
    addQuery,
    updateQuery,
    deleteQuery,
    toggleQuery,
    updateConfig,
    addDigest,
    getTodaysDigest,
  } = useDigestStore();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<{
    web: boolean;
    rag: boolean;
    checking: boolean;
  }>({ web: false, rag: false, checking: true });

  const todaysDigest = getTodaysDigest();
  const hasEnabledQueries = queries.some(q => q.enabled);

  // Check service availability on mount
  useEffect(() => {
    checkServiceAvailability();
  }, []);

  const checkServiceAvailability = async () => {
    setServiceStatus(prev => ({ ...prev, checking: true }));
    
    const [webAvailable, ragAvailable] = await Promise.all([
      digestService.isWebSearchAvailable(),
      digestService.isRAGAvailable(),
    ]);

    setServiceStatus({
      web: webAvailable,
      rag: ragAvailable,
      checking: false,
    });
  };

  const handleGenerateDigest = async () => {
    if (!hasEnabledQueries) {
      alert('Please add and enable at least one query before generating a digest.');
      return;
    }

    setIsGenerating(true);
    setGenerationStatus('Initializing digest generation...');

    try {
      setGenerationStatus('Processing your queries...');
      
      const newDigest = await digestService.generateDailyDigest(
        queries,
        config.maxTotalItems,
        config.enableAISummary
      );

      addDigest(newDigest);
      setGenerationStatus('Digest generated successfully!');
      
      // Clear status after a delay
      setTimeout(() => {
        setGenerationStatus(null);
      }, 3000);
    } catch (error) {
      console.error('Failed to generate digest:', error);
      setGenerationStatus('Failed to generate digest. Please try again.');
      
      setTimeout(() => {
        setGenerationStatus(null);
      }, 5000);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddQuery = (title: string, query: string, options: any) => {
    const id = addQuery(title, query, options);
    if (id) {
      setIsAddModalOpen(false);
    }
  };

  const getServiceStatusIcon = () => {
    if (serviceStatus.checking) {
      return <Clock className="w-4 h-4 text-yellow-500 animate-spin" />;
    }
    
    if (serviceStatus.web || serviceStatus.rag) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    
    return <AlertCircle className="w-4 h-4 text-red-500" />;
  };

  const getServiceStatusText = () => {
    if (serviceStatus.checking) {
      return 'Checking services...';
    }
    
    const availableServices = [];
    if (serviceStatus.web) availableServices.push('Web Search');
    if (serviceStatus.rag) availableServices.push('RAG');
    
    if (availableServices.length === 0) {
      return 'No services available';
    }
    
    return `Available: ${availableServices.join(', ')}`;
  };

  return (
    <div>
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Daily Digest
          </h1>
          <p className="text-gray-600">
            Create and manage your personalized daily news digest from multiple sources
          </p>
        </div>

        {/* Service Status */}
        <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getServiceStatusIcon()}
              <span className="text-sm font-medium">Service Status:</span>
              <span className="text-sm text-gray-600">{getServiceStatusText()}</span>
            </div>
            
            <button
              onClick={checkServiceAvailability}
              disabled={serviceStatus.checking}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh service status"
            >
              <RefreshCw className={`w-4 h-4 text-gray-600 ${serviceStatus.checking ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8 flex flex-wrap gap-4">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Query
          </button>

          <button
            onClick={handleGenerateDigest}
            disabled={isGenerating || !hasEnabledQueries}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            {isGenerating ? 'Generating...' : 'Generate Digest'}
          </button>

          {/* TODO: Add settings modal */}
          {/* <button className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
            <Settings className="w-4 h-4" />
            Settings
          </button> */}
        </div>

        {/* Generation Status */}
        {generationStatus && (
          <div className={`mb-6 p-4 rounded-lg ${
            generationStatus.includes('Failed') || generationStatus.includes('error')
              ? 'bg-red-50 border border-red-200 text-red-800'
              : generationStatus.includes('successfully')
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-blue-50 border border-blue-200 text-blue-800'
          }`}>
            <div className="flex items-center gap-2">
              {isGenerating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : generationStatus.includes('successfully') ? (
                <CheckCircle className="w-4 h-4" />
              ) : generationStatus.includes('Failed') ? (
                <AlertCircle className="w-4 h-4" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
              <span className="font-medium">{generationStatus}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Queries */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Search Queries ({queries.length})
              </h2>
              
              {queries.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No queries configured yet.</p>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Add your first query
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {queries.map((query) => (
                    <DigestQueryCard
                      key={query.id}
                      query={query}
                      onUpdate={updateQuery}
                      onDelete={deleteQuery}
                      onToggle={toggleQuery}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Digests */}
          <div className="lg:col-span-2">
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Recent Digests
              </h2>

              {/* Today's Digest */}
              {todaysDigest && (
                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-3">Today</h3>
                  <DigestCard digest={todaysDigest} />
                </div>
              )}

              {/* Previous Digests */}
              {digests.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-3">Previous Digests</h3>
                  <div className="space-y-4">
                    {digests
                      .filter(d => d.date !== new Date().toISOString().split('T')[0])
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .slice(0, 5)
                      .map((digest) => (
                        <DigestCard key={digest.id} digest={digest} />
                      ))}
                  </div>
                </div>
              )}

              {digests.length === 0 && (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                  <p className="text-gray-500 mb-4">No digests generated yet.</p>
                  <p className="text-sm text-gray-400">
                    Add some queries and generate your first digest to get started.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Query Modal */}
      <AddDigestQueryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddQuery}
      />
    </div>
  );
};

export default DigestView;