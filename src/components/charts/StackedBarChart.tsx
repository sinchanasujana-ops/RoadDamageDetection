import React, { useState } from 'react';

interface LocationSeverityItem {
  location: string;
  Low: number;
  Medium: number;
  High: number;
  total: number;
}

interface StackedBarChartProps {
  data: Record<string, { Low: number; Medium: number; High: number }>;
  title: string;
}

export const StackedBarChart: React.FC<StackedBarChartProps> = ({ data, title }) => {
  const [hoveredLoc, setHoveredLoc] = useState<string | null>(null);

  const entries: LocationSeverityItem[] = Object.entries(data).map(([loc, counts]) => ({
    location: loc,
    Low: counts.Low || 0,
    Medium: counts.Medium || 0,
    High: counts.High || 0,
    total: (counts.Low || 0) + (counts.Medium || 0) + (counts.High || 0),
  }));

  // Sort by total descending
  entries.sort((a, b) => b.total - a.total);

  if (entries.length === 0) {
    return (
      <div className="border border-[#dedad0] bg-[#f5f4ef] p-5">
        <div className="mb-4 flex items-center justify-between border-b border-[#dedad0] pb-2">
          <h4 className="font-heading text-lg font-bold uppercase tracking-wider text-[#1b1c1e]">{title}</h4>
        </div>
        <div className="flex h-48 items-center justify-center font-mono text-xs text-neutral-500">
          No location severity logs recorded
        </div>
      </div>
    );
  }

  const maxTotal = Math.max(...entries.map((e) => e.total), 1);

  return (
    <div className="border border-[#dedad0] bg-[#f5f4ef] p-5">
      <div className="mb-4 flex items-center justify-between border-b border-[#dedad0] pb-2">
        <div>
          <h4 className="font-heading text-lg font-bold uppercase tracking-wider text-[#1b1c1e]">{title}</h4>
          <span className="font-mono text-xs text-neutral-500">
            Hazard distribution across surveyed zones
          </span>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 bg-[#d94f45]"></span>
            <span>High</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 bg-[#e0a13a]"></span>
            <span>Med</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 bg-[#3fa564]"></span>
            <span>Low</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {entries.map((entry) => {
          const highPct = entry.total > 0 ? (entry.High / entry.total) * 100 : 0;
          const medPct = entry.total > 0 ? (entry.Medium / entry.total) * 100 : 0;
          const lowPct = entry.total > 0 ? (entry.Low / entry.total) * 100 : 0;
          const barWidthPct = (entry.total / maxTotal) * 100;

          const isHovered = hoveredLoc === entry.location;

          return (
            <div
              key={entry.location}
              className={`p-2 transition-colors border ${
                isHovered ? 'bg-white border-[#1b1c1e]' : 'border-transparent hover:border-[#dedad0]'
              }`}
              onMouseEnter={() => setHoveredLoc(entry.location)}
              onMouseLeave={() => setHoveredLoc(null)}
            >
              <div className="mb-1.5 flex items-center justify-between font-mono text-xs">
                <span className="truncate pr-2 font-semibold text-[#1b1c1e]">{entry.location}</span>
                <span className="tabular-nums font-bold text-neutral-800">
                  {entry.total} total <span className="font-normal text-neutral-500">({entry.High}H / {entry.Medium}M / {entry.Low}L)</span>
                </span>
              </div>

              {/* Progress Container scaled relative to maxTotal */}
              <div className="h-7 w-full overflow-hidden bg-[#e5e2d8] border border-[#dedad0] flex">
                <div
                  className="flex h-full transition-all duration-500"
                  style={{ width: `${Math.max(barWidthPct, 8)}%` }}
                >
                  {/* High severity segment */}
                  {entry.High > 0 && (
                    <div
                      style={{ width: `${highPct}%` }}
                      className="h-full bg-[#d94f45] flex items-center justify-center text-[10px] font-mono font-bold text-white transition-all hover:brightness-110"
                      title={`${entry.location} - High Severity: ${entry.High} (${highPct.toFixed(0)}%)`}
                    >
                      {highPct >= 14 ? entry.High : ''}
                    </div>
                  )}

                  {/* Medium severity segment */}
                  {entry.Medium > 0 && (
                    <div
                      style={{ width: `${medPct}%` }}
                      className="h-full bg-[#e0a13a] flex items-center justify-center text-[10px] font-mono font-bold text-white transition-all hover:brightness-110"
                      title={`${entry.location} - Medium Severity: ${entry.Medium} (${medPct.toFixed(0)}%)`}
                    >
                      {medPct >= 14 ? entry.Medium : ''}
                    </div>
                  )}

                  {/* Low severity segment */}
                  {entry.Low > 0 && (
                    <div
                      style={{ width: `${lowPct}%` }}
                      className="h-full bg-[#3fa564] flex items-center justify-center text-[10px] font-mono font-bold text-white transition-all hover:brightness-110"
                      title={`${entry.location} - Low Severity: ${entry.Low} (${lowPct.toFixed(0)}%)`}
                    >
                      {lowPct >= 14 ? entry.Low : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
