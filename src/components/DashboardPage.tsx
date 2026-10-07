import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  RefreshCw,
  Search,
  Filter,
  Download,
  AlertTriangle,
  Database,
  CheckCircle,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { DetectionRecord, SeverityLevel } from '../types/detection';
import { BarChart } from './charts/BarChart';
import { DonutChart } from './charts/DonutChart';
import { StackedBarChart } from './charts/StackedBarChart';

interface DashboardPageProps {
  records: DetectionRecord[];
  isLiveSupabase: boolean;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenPowerBiModal: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  records,
  isLiveSupabase,
  isLoading,
  onRefresh,
  onOpenPowerBiModal,
}) => {
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterDamageType, setFilterDamageType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Extract unique locations and damage types for filter select options
  const uniqueLocations = useMemo(() => {
    const locs = new Set<string>();
    records.forEach((r) => {
      if (r.location) locs.add(r.location);
    });
    return Array.from(locs);
  }, [records]);

  const uniqueDamageTypes = useMemo(() => {
    const types = new Set<string>();
    records.forEach((r) => {
      if (r.damage_type) types.add(r.damage_type);
    });
    return Array.from(types);
  }, [records]);

  // Filter records based on active criteria
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (filterLocation !== 'all' && r.location !== filterLocation) return false;
      if (filterSeverity !== 'all' && r.severity !== filterSeverity) return false;
      if (filterDamageType !== 'all' && r.damage_type !== filterDamageType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesFile = r.source_file.toLowerCase().includes(q);
        const matchesLoc = r.location.toLowerCase().includes(q);
        const matchesType = r.damage_type.toLowerCase().includes(q);
        if (!matchesFile && !matchesLoc && !matchesType) return false;
      }
      return true;
    });
  }, [records, filterLocation, filterSeverity, filterDamageType, searchQuery]);

  // KPI calculations
  const totalDetections = filteredRecords.length;

  const averageConfidence = useMemo(() => {
    if (totalDetections === 0) return 0;
    const sum = filteredRecords.reduce((acc, curr) => acc + (curr.confidence || 0), 0);
    return (sum / totalDetections) * 100;
  }, [filteredRecords, totalDetections]);

  const highSeverityPercent = useMemo(() => {
    if (totalDetections === 0) return 0;
    const highCount = filteredRecords.filter((r) => r.severity === 'High').length;
    return (highCount / totalDetections) * 100;
  }, [filteredRecords, totalDetections]);

  // Chart data 1: Count by damage_type
  const damageTypeChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredRecords.forEach((r) => {
      const type = r.damage_type || 'Unknown';
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts).map(([label, value]) => ({
      label,
      value,
      color: '#1b1c1e',
    }));
  }, [filteredRecords]);

  // Chart data 2: Severity breakdown (Low/Medium/High)
  const severityBreakdownData = useMemo(() => {
    const counts = { Low: 0, Medium: 0, High: 0 };
    filteredRecords.forEach((r) => {
      if (r.severity === 'High') counts.High += 1;
      else if (r.severity === 'Medium') counts.Medium += 1;
      else if (r.severity === 'Low') counts.Low += 1;
    });
    return counts;
  }, [filteredRecords]);

  // Chart data 3: Count by location
  const locationChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredRecords.forEach((r) => {
      const loc = r.location || 'Unspecified';
      counts[loc] = (counts[loc] || 0) + 1;
    });
    return Object.entries(counts).map(([label, value]) => ({
      label,
      value,
      color: '#26282b',
    }));
  }, [filteredRecords]);

  // Chart data 4: Stacked severity breakdown per location
  const stackedLocationData = useMemo(() => {
    const breakdown: Record<string, { Low: number; Medium: number; High: number }> = {};
    filteredRecords.forEach((r) => {
      const loc = r.location || 'Unspecified';
      if (!breakdown[loc]) {
        breakdown[loc] = { Low: 0, Medium: 0, High: 0 };
      }
      if (r.severity === 'High') breakdown[loc].High += 1;
      else if (r.severity === 'Medium') breakdown[loc].Medium += 1;
      else if (r.severity === 'Low') breakdown[loc].Low += 1;
    });
    return breakdown;
  }, [filteredRecords]);

  const getSeverityBadge = (severity: SeverityLevel) => {
    switch (severity) {
      case 'High':
        return 'bg-[#d94f45] text-white';
      case 'Medium':
        return 'bg-[#e0a13a] text-white';
      case 'Low':
        return 'bg-[#3fa564] text-white';
      default:
        return 'bg-neutral-600 text-white';
    }
  };

  const handleExportCsv = () => {
    if (filteredRecords.length === 0) return;
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
    const rows = filteredRecords.map((r) => [
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
    link.download = `detections_export_${Date.now()}.csv`;
    link.click();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
      {/* Dashboard Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#dedad0] pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-[#1b1c1e]">
              Live Road Damage Telemetry
            </h1>
            <div
              className={`flex items-center gap-1.5 px-2.5 py-0.5 font-mono text-[11px] font-bold border ${
                isLiveSupabase
                  ? 'border-[#3fa564] bg-[#3fa564]/10 text-[#3fa564]'
                  : 'border-[#e0a13a] bg-[#e0a13a]/10 text-[#e0a13a]'
              }`}
            >
              <Database className="h-3 w-3" />
              <span>{isLiveSupabase ? 'Supabase Postgres: Active' : 'Supabase: Local Cache'}</span>
            </div>
          </div>
          <p className="font-mono text-xs text-neutral-600 mt-1">
            Real-time synchronization across this dashboard and connected Microsoft Power BI Desktop models
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 border border-[#1b1c1e] bg-white px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-wider text-[#1b1c1e] transition-colors hover:bg-[#eceae3] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Table</span>
          </button>

          <button
            onClick={onOpenPowerBiModal}
            className="flex items-center gap-1.5 border border-[#1b1c1e] bg-[#f5c518] px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-wider text-[#1b1c1e] transition-colors hover:bg-yellow-400"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Power BI Connector</span>
          </button>
        </div>
      </div>

      {/* KPI CARDS: total detections, average confidence, % high severity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* KPI 1: Total Detections */}
        <div className="border-2 border-[#1b1c1e] bg-white p-5 relative overflow-hidden shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-neutral-500">
              Total Detections Logged
            </span>
            <span className="h-2 w-2 bg-[#1b1c1e]"></span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-heading text-5xl font-black text-[#1b1c1e] tabular-nums">
              {totalDetections}
            </span>
            <span className="font-mono text-xs text-neutral-500">distress events</span>
          </div>
          <div className="mt-3 border-t border-[#dedad0] pt-2 font-mono text-[11px] text-neutral-600 flex justify-between">
            <span>Supabase `detections` row count</span>
            <span className="font-bold">{records.length} all-time</span>
          </div>
        </div>

        {/* KPI 2: Average Confidence */}
        <div className="border-2 border-[#1b1c1e] bg-white p-5 relative overflow-hidden shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-neutral-500">
              Average Model Confidence
            </span>
            <span className="h-2 w-2 bg-[#f5c518]"></span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-heading text-5xl font-black text-[#1b1c1e] tabular-nums">
              {averageConfidence.toFixed(1)}%
            </span>
            <span className="font-mono text-xs text-neutral-500">mean score</span>
          </div>
          <div className="mt-3 border-t border-[#dedad0] pt-2 font-mono text-[11px] text-neutral-600 flex justify-between">
            <span>YOLOv8 bounding box certainty</span>
            <span className="font-bold text-[#3fa564]">Nominal</span>
          </div>
        </div>

        {/* KPI 3: % High Severity */}
        <div className="border-2 border-[#1b1c1e] bg-white p-5 relative overflow-hidden shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-neutral-500">
              High Severity Ratio
            </span>
            <span className="h-2 w-2 bg-[#d94f45]"></span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-heading text-5xl font-black text-[#d94f45] tabular-nums">
              {highSeverityPercent.toFixed(1)}%
            </span>
            <span className="font-mono text-xs text-neutral-500">critical distresses</span>
          </div>
          <div className="mt-3 border-t border-[#dedad0] pt-2 font-mono text-[11px] text-neutral-600 flex justify-between">
            <span>Immediate repair priority</span>
            <span className="font-bold text-[#d94f45]">
              {severityBreakdownData.High} instances
            </span>
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS BAR */}
      <div className="border border-[#dedad0] bg-[#f5f4ef] p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-neutral-700">
            <Filter className="h-3.5 w-3.5" />
            <span>Filters:</span>
          </div>

          {/* Location Filter */}
          <select
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="border border-[#dedad0] bg-white px-2.5 py-1.5 font-mono text-xs text-[#1b1c1e] focus:border-[#1b1c1e] focus:outline-hidden"
          >
            <option value="all">All Locations ({uniqueLocations.length})</option>
            {uniqueLocations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>

          {/* Damage Type Filter */}
          <select
            value={filterDamageType}
            onChange={(e) => setFilterDamageType(e.target.value)}
            className="border border-[#dedad0] bg-white px-2.5 py-1.5 font-mono text-xs text-[#1b1c1e] focus:border-[#1b1c1e] focus:outline-hidden"
          >
            <option value="all">All Distress Types ({uniqueDamageTypes.length})</option>
            {uniqueDamageTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          {/* Severity Filter */}
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="border border-[#dedad0] bg-white px-2.5 py-1.5 font-mono text-xs text-[#1b1c1e] focus:border-[#1b1c1e] focus:outline-hidden"
          >
            <option value="all">All Severities</option>
            <option value="High">High Severity</option>
            <option value="Medium">Medium Severity</option>
            <option value="Low">Low Severity</option>
          </select>
        </div>

        {/* Search input & CSV export */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search source or road..."
              className="border border-[#dedad0] bg-white pl-8 pr-3 py-1 font-mono text-xs text-[#1b1c1e] focus:border-[#1b1c1e] focus:outline-hidden"
            />
          </div>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1 border border-[#1b1c1e] bg-white px-2.5 py-1 font-mono text-xs text-[#1b1c1e] hover:bg-[#eceae3]"
            title="Export filtered records as CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* CHARTS GRID 1: Bar chart: count by damage_type & Donut chart: severity breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <BarChart
            data={damageTypeChartData}
            title="Distress Frequency by Damage Type"
            height={280}
            unit="records"
          />
        </div>

        <div className="lg:col-span-5">
          <DonutChart data={severityBreakdownData} title="Severity Classification Index" />
        </div>
      </div>

      {/* CHARTS GRID 2: Bar chart: count by location & Stacked bar chart: severity breakdown per location */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5">
          <BarChart
            data={locationChartData}
            title="Detections by Survey Location"
            height={290}
            unit="events"
            horizontal={true}
          />
        </div>

        <div className="lg:col-span-7">
          <StackedBarChart
            data={stackedLocationData}
            title="Severity Breakdown per Location"
          />
        </div>
      </div>

      {/* DASHBOARD HISTORICAL TABLE */}
      <div className="border border-[#1b1c1e] bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b-2 border-[#1b1c1e] bg-[#1b1c1e] px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#f5c518]" />
            <h3 className="font-heading text-lg font-bold uppercase tracking-wider text-white">
              Supabase `detections` Raw Telemetry Log
            </h3>
          </div>
          <div className="font-mono text-xs text-neutral-300">
            Showing {filteredRecords.length} of {records.length} logged rows
          </div>
        </div>

        <div className="overflow-x-auto max-h-[420px]">
          <table className="w-full text-left font-mono text-xs">
            <thead className="sticky top-0 bg-[#f5f4ef] border-b border-[#dedad0] text-neutral-700 font-bold uppercase">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Location</th>
                <th className="py-2.5 px-3">Damage Type</th>
                <th className="py-2.5 px-3">Confidence</th>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Severity Score</th>
                <th className="py-2.5 px-3">Source File</th>
                <th className="py-2.5 px-3">Bounding Box</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dedad0]">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-neutral-500">
                    No detection records match the active criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, i) => (
                  <tr key={r.id || i} className="hover:bg-[#f5f4ef] transition-colors">
                    <td className="py-2.5 px-3 text-neutral-500 tabular-nums whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-[#1b1c1e] whitespace-nowrap">
                      {r.location}
                    </td>
                    <td className="py-2.5 px-3 uppercase font-medium">{r.damage_type}</td>
                    <td className="py-2.5 px-3 font-bold tabular-nums">
                      {(r.confidence * 100).toFixed(0)}%
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase ${getSeverityBadge(
                          r.severity
                        )}`}
                      >
                        {r.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-neutral-700">
                      {Number(r.severity_score).toFixed(4)}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-500 truncate max-w-[150px]" title={r.source_file}>
                      {r.source_file}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-500 tabular-nums whitespace-nowrap">
                      [{r.x1}, {r.y1}, {r.x2}, {r.y2}]
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
