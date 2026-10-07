import React from 'react';
import { Camera, BarChart3, Database, Cpu, Award } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';

interface HeaderProps {
  activeTab: 'detect' | 'train' | 'dashboard';
  setActiveTab: (tab: 'detect' | 'train' | 'dashboard') => void;
  onOpenPowerBiModal: () => void;
  onOpenYoloModal: () => void;
  detectionCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenPowerBiModal,
  onOpenYoloModal,
  detectionCount,
}) => {
  const isSupabaseLive = isSupabaseConfigured();

  return (
    <header className="sticky top-0 z-40 bg-[#1b1c1e] text-white shadow-md">
      {/* Top Bar (One-row, 3-zone contract) */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Zone 1: Brand title in display face */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center bg-[#f5c518] text-[#1b1c1e] font-black">
            <span className="font-heading text-xl tracking-tighter">RD</span>
          </div>
          <div>
            <div className="font-heading text-xl sm:text-2xl font-bold uppercase tracking-wider text-white">
              Road Damage Telemetry &amp; Analysis
            </div>
            <div className="hidden sm:block font-mono text-[11px] text-neutral-400">
              YOLOv8 Distress Inference · Supabase PostgreSQL · Power BI Direct
            </div>
          </div>
        </div>

        {/* Zone 2: Navigation Links / Segmented Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('detect')}
            className={`flex items-center gap-2 px-3 py-2 font-heading text-sm sm:text-base font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'detect'
                ? 'bg-[#f5c518] text-[#1b1c1e]'
                : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
            }`}
          >
            <Camera className="h-4 w-4" />
            <span>Upload &amp; Detect</span>
          </button>

          <button
            onClick={() => setActiveTab('train')}
            className={`flex items-center gap-2 px-3 py-2 font-heading text-sm sm:text-base font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'train'
                ? 'bg-[#f5c518] text-[#1b1c1e]'
                : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
            }`}
          >
            <Award className="h-4 w-4" />
            <span>Training &amp; Accuracy</span>
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-3 py-2 font-heading text-sm sm:text-base font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'dashboard'
                ? 'bg-[#f5c518] text-[#1b1c1e]'
                : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Analytics</span>
            {detectionCount > 0 && (
              <span
                className={`px-1.5 py-0.2 font-mono text-[11px] font-bold ${
                  activeTab === 'dashboard'
                    ? 'bg-[#1b1c1e] text-[#f5c518]'
                    : 'bg-neutral-800 text-neutral-300'
                }`}
              >
                {detectionCount}
              </span>
            )}
          </button>
        </nav>

        {/* Zone 3: Primary Actions (YOLOv8 Specs + Power BI & DB Setup) */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenYoloModal}
            className="flex items-center gap-1.5 border border-neutral-700 bg-neutral-900 px-3 py-1.5 font-mono text-xs font-medium text-neutral-300 transition-colors hover:border-[#f5c518] hover:text-[#f5c518] hover:bg-black"
            title="Inspect YOLOv8 Architecture, Backbone, and Hyperparameters"
          >
            <Cpu className="h-3.5 w-3.5 text-[#f5c518]" />
            <span className="hidden md:inline">YOLOv8 Specs</span>
          </button>

          <button
            onClick={onOpenPowerBiModal}
            className="flex items-center gap-1.5 border border-neutral-700 bg-neutral-900 px-3 py-1.5 font-mono text-xs font-medium text-[#f5c518] transition-colors hover:border-[#f5c518] hover:bg-black"
            title="Configure Supabase Database & Power BI Desktop connector"
          >
            <Database className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden md:inline">Power BI &amp; DB</span>
            {isSupabaseLive ? (
              <span className="inline-block h-2 w-2 rounded-full bg-[#3fa564]" title="Supabase Active" />
            ) : (
              <span
                className="inline-block h-2 w-2 rounded-full bg-[#e0a13a]"
                title="Local / Config Required"
              />
            )}
          </button>
        </div>
      </div>

      {/* Yellow road-marking dashed divider motif */}
      <div className="road-marking-divider"></div>
    </header>
  );
};
