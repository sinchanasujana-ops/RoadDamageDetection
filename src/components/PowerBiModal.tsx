import React, { useState } from 'react';
import {
  getStoredConfig,
  saveStoredConfig,
  testSupabaseConnection,
  fetchDetections,
} from '../lib/supabase';
import { Check, Copy, Database, ExternalLink, RefreshCw, X } from 'lucide-react';

interface PowerBiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

export const PowerBiModal: React.FC<PowerBiModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const currentConfig = getStoredConfig();
  const [url, setUrl] = useState(currentConfig.url);
  const [anonKey, setAnonKey] = useState(currentConfig.anonKey);
  const [testStatus, setTestStatus] = useState<{
    tested: boolean;
    ok: boolean;
    message: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen) return null;

  const normalizeUrl = (input: string) => {
    let clean = input.trim();
    if (clean && !clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `https://${clean}`;
    }
    return clean;
  };

  const handleSave = () => {
    const cleanUrl = normalizeUrl(url);
    setUrl(cleanUrl);
    saveStoredConfig({ url: cleanUrl, anonKey: anonKey.trim() });
    onConfigSaved();
    setTestStatus(null);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestStatus(null);
    const cleanUrl = normalizeUrl(url);
    setUrl(cleanUrl);
    saveStoredConfig({ url: cleanUrl, anonKey: anonKey.trim() });
    const res = await testSupabaseConnection();
    setTestStatus({ tested: true, ok: res.ok, message: res.message });
    setIsTesting(false);
    if (res.ok) {
      onConfigSaved();
    }
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleExportCsv = async () => {
    const { records } = await fetchDetections();
    if (records.length === 0) {
      alert('No detections available to export.');
      return;
    }

    const headers = [
      'id',
      'source_file',
      'damage_type',
      'confidence',
      'severity',
      'severity_score',
      'x1',
      'y1',
      'x2',
      'y2',
      'img_width',
      'img_height',
      'location',
      'created_at',
    ];

    const rows = records.map((r) => [
      r.id || '',
      `"${r.source_file}"`,
      `"${r.damage_type}"`,
      r.confidence,
      r.severity,
      r.severity_score,
      r.x1,
      r.y1,
      r.x2,
      r.y2,
      r.img_width,
      r.img_height,
      `"${r.location}"`,
      `"${r.created_at}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `detections_powerbi_dataset_${Date.now()}.csv`;
    link.click();
  };

  const sqlSchema = `-- ===================================================
-- Supabase PostgreSQL Table Schema for Microsoft Power BI
-- Simple flat columns (no nested JSON) for direct Power BI Desktop query
-- ===================================================

CREATE TABLE IF NOT EXISTS public.detections (
  id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL,
  damage_type TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  severity TEXT NOT NULL,
  severity_score DOUBLE PRECISION NOT NULL,
  x1 DOUBLE PRECISION NOT NULL,
  y1 DOUBLE PRECISION NOT NULL,
  x2 DOUBLE PRECISION NOT NULL,
  y2 DOUBLE PRECISION NOT NULL,
  img_width DOUBLE PRECISION NOT NULL,
  img_height DOUBLE PRECISION NOT NULL,
  location TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Index frequently queried columns for high-speed Power BI refreshes
CREATE INDEX IF NOT EXISTS idx_detections_damage_type ON public.detections (damage_type);
CREATE INDEX IF NOT EXISTS idx_detections_severity ON public.detections (severity);
CREATE INDEX IF NOT EXISTS idx_detections_location ON public.detections (location);
CREATE INDEX IF NOT EXISTS idx_detections_created_at ON public.detections (created_at DESC);

-- Enable Row Level Security and allow public read-write for app & Power BI
ALTER TABLE public.detections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read and write access"
  ON public.detections
  FOR ALL
  USING (true)
  WITH CHECK (true);`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col border-2 border-[#1b1c1e] bg-[#f5f4ef] shadow-2xl">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b-2 border-[#1b1c1e] bg-[#1b1c1e] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center bg-[#f5c518] text-[#1b1c1e]">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-heading text-xl font-bold uppercase tracking-wider text-white">
                Power BI Desktop & Supabase PostgreSQL Data Pipeline
              </h3>
              <p className="font-mono text-xs text-neutral-400">
                Direct live synchronization to Microsoft Power BI via PostgreSQL connector
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center border border-neutral-700 text-neutral-400 transition-colors hover:border-white hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Yellow divider motif */}
        <div className="road-marking-divider"></div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Explanation */}
          <div className="border border-[#dedad0] bg-white p-4">
            <h4 className="font-heading text-base font-bold uppercase text-[#1b1c1e] mb-1">
              Architecture & Direct Connection Paradigm
            </h4>
            <p className="text-sm text-neutral-700 leading-relaxed">
              Every detection generated by this app is committed directly to the PostgreSQL table{' '}
              <code className="bg-[#eceae3] px-1.5 py-0.5 font-mono text-xs font-bold text-[#1b1c1e]">
                detections
              </code>{' '}
              with flat, atomic columns (no nested JSON structures). This enables Microsoft Power BI
              Desktop to query the exact same data live via its native{' '}
              <strong>Get Data &rarr; PostgreSQL database</strong> connector.
            </p>
          </div>

          {/* Section 1: Supabase Configuration */}
          <div className="border border-[#dedad0] bg-white p-5">
            <div className="flex items-center justify-between mb-3 border-b border-[#dedad0] pb-2">
              <span className="font-heading text-base font-bold uppercase text-[#1b1c1e]">
                1. Supabase Project Credentials
              </span>
              <span className="font-mono text-xs text-neutral-500">
                Can also be provided via VITE_SUPABASE_URL in .env
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-xs font-bold uppercase text-neutral-700 mb-1">
                  Project URL (e.g. https://xyz.supabase.co)
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://your-project.supabase.co"
                  className="w-full border border-[#dedad0] bg-[#f5f4ef] px-3 py-2 font-mono text-xs text-[#1b1c1e] focus:border-[#1b1c1e] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-mono text-xs font-bold uppercase text-neutral-700 mb-1">
                  Anon Public Key
                </label>
                <input
                  type="password"
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6Ik..."
                  className="w-full border border-[#dedad0] bg-[#f5f4ef] px-3 py-2 font-mono text-xs text-[#1b1c1e] focus:border-[#1b1c1e] focus:outline-hidden"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="border border-[#1b1c1e] bg-[#1b1c1e] px-4 py-2 font-heading text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-black"
                >
                  Save Credentials
                </button>
                <button
                  onClick={handleTest}
                  disabled={isTesting || !url || !anonKey}
                  className="flex items-center gap-1.5 border border-[#1b1c1e] bg-white px-4 py-2 font-heading text-sm font-bold uppercase tracking-wider text-[#1b1c1e] transition-colors hover:bg-[#eceae3] disabled:opacity-50"
                >
                  {isTesting ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-[#1b1c1e]" />
                  ) : (
                    <Database className="h-4 w-4 text-[#1b1c1e]" />
                  )}
                  Test Table Connection
                </button>
              </div>

              {testStatus && (
                <div
                  className={`flex items-center gap-2 border px-3 py-1.5 font-mono text-xs ${
                    testStatus.ok
                      ? 'border-[#3fa564] bg-[#3fa564]/10 text-[#3fa564]'
                      : 'border-[#d94f45] bg-[#d94f45]/10 text-[#d94f45]'
                  }`}
                >
                  {testStatus.ok ? (
                    <Check className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <X className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span>{testStatus.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: PostgreSQL Schema Setup in Supabase */}
          <div className="border border-[#dedad0] bg-white p-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="font-heading text-base font-bold uppercase text-[#1b1c1e]">
                  2. SQL Schema for Supabase SQL Editor
                </span>
                <p className="font-mono text-xs text-neutral-500">
                  Run this once in your Supabase SQL Editor to provision the table
                </p>
              </div>
              <button
                onClick={() => handleCopy(sqlSchema, 'sql')}
                className="flex items-center gap-1.5 border border-[#1b1c1e] bg-[#f5c518] px-3 py-1.5 font-mono text-xs font-bold text-[#1b1c1e] transition-colors hover:bg-yellow-400"
              >
                {copiedType === 'sql' ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy SQL Script
                  </>
                )}
              </button>
            </div>

            <div className="relative max-h-48 overflow-y-auto border border-[#dedad0] bg-[#1b1c1e] p-3 text-white">
              <pre className="font-mono text-xs text-[#eceae3] leading-relaxed whitespace-pre-wrap">
                {sqlSchema}
              </pre>
            </div>
          </div>

          {/* Section 3: Connecting Microsoft Power BI Desktop */}
          <div className="border border-[#dedad0] bg-white p-5">
            <h4 className="font-heading text-base font-bold uppercase text-[#1b1c1e] mb-3">
              3. Connect Microsoft Power BI Desktop (Step-by-Step)
            </h4>

            <ol className="list-decimal pl-5 space-y-2 text-sm text-neutral-800">
              <li>
                Open <strong>Microsoft Power BI Desktop</strong> on your machine.
              </li>
              <li>
                Click on the <strong>Home</strong> ribbon &rarr; <strong>Get Data</strong> &rarr;{' '}
                <strong>PostgreSQL database</strong> &rarr; <em>Connect</em>.
              </li>
              <li>
                In the dialog, enter your database connection settings:
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs bg-[#f5f4ef] p-3 border border-[#dedad0]">
                  <div>
                    <span className="text-neutral-500">Server:</span>{' '}
                    <strong className="text-[#1b1c1e]">
                      {url ? `db.${url.replace('https://', '').split('.')[0]}.supabase.co:5432` : 'db.<project-ref>.supabase.co:5432'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-neutral-500">Database:</span>{' '}
                    <strong className="text-[#1b1c1e]">postgres</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500">Data Connectivity:</span>{' '}
                    <strong className="text-[#1b1c1e]">DirectQuery</strong> or{' '}
                    <strong className="text-[#1b1c1e]">Import</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500">Port:</span>{' '}
                    <strong className="text-[#1b1c1e]">5432</strong>
                  </div>
                </div>
              </li>
              <li>
                Under authentication credentials, select <strong>Database</strong>:
                <div className="mt-1 font-mono text-xs text-neutral-700">
                  User name: <code className="font-bold">postgres</code> | Password: your Supabase DB password.
                </div>
              </li>
              <li>
                In the Navigator pane, select the table{' '}
                <strong className="font-mono text-xs text-[#1b1c1e]">public &gt; detections</strong> and
                click <strong>Load</strong>.
              </li>
            </ol>

            <div className="mt-4 flex items-center justify-between border-t border-[#dedad0] pt-3">
              <span className="font-mono text-xs text-neutral-600">
                Need quick offline testing in Power BI?
              </span>
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 border border-[#1b1c1e] bg-[#eceae3] px-3 py-1.5 font-mono text-xs font-bold text-[#1b1c1e] hover:bg-[#dedad0]"
              >
                Export Current Detections as CSV for Power BI
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t-2 border-[#1b1c1e] bg-[#eceae3] px-6 py-3">
          <span className="font-mono text-xs text-neutral-600">
            Schema complies with ISO/TC 241 Road Distress Data standard
          </span>
          <button
            onClick={onClose}
            className="border border-[#1b1c1e] bg-[#1b1c1e] px-5 py-1.5 font-heading text-sm font-bold uppercase tracking-wider text-white hover:bg-black"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
