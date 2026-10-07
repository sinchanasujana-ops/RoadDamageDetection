/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { UploadDetectPage } from './components/UploadDetectPage';
import { ModelTrainingPage } from './components/ModelTrainingPage';
import { DashboardPage } from './components/DashboardPage';
import { PowerBiModal } from './components/PowerBiModal';
import { YoloInspectorModal } from './components/YoloInspectorModal';
import { fetchDetections } from './lib/supabase';
import { DetectionRecord } from './types/detection';
import { Database, Activity, ExternalLink, Cpu } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'detect' | 'train' | 'dashboard'>('detect');
  const [isPowerBiModalOpen, setIsPowerBiModalOpen] = useState<boolean>(false);
  const [isYoloModalOpen, setIsYoloModalOpen] = useState<boolean>(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.7);
  const [iouThreshold, setIouThreshold] = useState<number>(0.45);
  const [records, setRecords] = useState<DetectionRecord[]>([]);
  const [isLiveSupabase, setIsLiveSupabase] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { records: fetchedRecords, isLiveSupabase: live } = await fetchDetections();
      setRecords(fetchedRecords);
      setIsLiveSupabase(live);
    } catch (e) {
      console.error('Error fetching detections in App:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="min-h-screen flex flex-col bg-[#eceae3] text-[#1b1c1e] selection:bg-[#f5c518] selection:text-[#1b1c1e]">
      {/* Asphalt Header with Yellow road-marking accent motif */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenPowerBiModal={() => setIsPowerBiModalOpen(true)}
        onOpenYoloModal={() => setIsYoloModalOpen(true)}
        detectionCount={records.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {activeTab === 'detect' && (
          <UploadDetectPage
            onDetectionsLogged={loadData}
            onOpenPowerBiModal={() => setIsPowerBiModalOpen(true)}
          />
        )}
        {activeTab === 'train' && <ModelTrainingPage />}
        {activeTab === 'dashboard' && (
          <DashboardPage
            records={records}
            isLiveSupabase={isLiveSupabase}
            isLoading={isLoading}
            onRefresh={loadData}
            onOpenPowerBiModal={() => setIsPowerBiModalOpen(true)}
          />
        )}
      </main>

      {/* Technical Footer */}
      <footer className="border-t border-[#dedad0] bg-[#e5e2d8] text-neutral-700 py-6 font-mono text-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 bg-[#f5c518]"></span>
            <span className="font-bold text-[#1b1c1e]">ROAD DAMAGE TELEMETRY</span>
            <span className="text-neutral-400">|</span>
            <span>YOLOv8n-RDD Real-Time Inference Protocol</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <button
              onClick={() => setIsYoloModalOpen(true)}
              className="flex items-center gap-1 font-bold text-[#1b1c1e] hover:underline"
            >
              <Cpu className="h-3 w-3 text-[#f5c518]" />
              <span>YOLOv8 Network Details</span>
            </button>
            <span className="text-neutral-400">·</span>
            <button
              onClick={() => setIsPowerBiModalOpen(true)}
              className="flex items-center gap-1 font-bold text-[#1b1c1e] hover:underline"
            >
              <Database className="h-3 w-3" />
              <span>Supabase / Power BI Sync</span>
            </button>
            <span className="text-neutral-400">·</span>
            <span className="text-neutral-500">
              {records.length} total events indexed
            </span>
          </div>
        </div>
      </footer>

      {/* Power BI & Supabase Connection Modal */}
      <PowerBiModal
        isOpen={isPowerBiModalOpen}
        onClose={() => setIsPowerBiModalOpen(false)}
        onConfigSaved={loadData}
      />

      {/* YOLOv8 Neural Architecture Modal */}
      <YoloInspectorModal
        isOpen={isYoloModalOpen}
        onClose={() => setIsYoloModalOpen(false)}
        confidenceThreshold={confidenceThreshold}
        setConfidenceThreshold={setConfidenceThreshold}
        iouThreshold={iouThreshold}
        setIouThreshold={setIouThreshold}
      />
    </div>
  );
}
