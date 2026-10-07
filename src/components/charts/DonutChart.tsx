import React, { useState } from 'react';
import { SeverityLevel } from '../../types/detection';

interface DonutSlice {
  label: SeverityLevel;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: {
    Low: number;
    Medium: number;
    High: number;
  };
  title: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({ data, title }) => {
  const [hovered, setHovered] = useState<SeverityLevel | null>(null);

  const total = data.Low + data.Medium + data.High;

  const slices: DonutSlice[] = [
    { label: 'High', value: data.High, color: '#d94f45' },
    { label: 'Medium', value: data.Medium, color: '#e0a13a' },
    { label: 'Low', value: data.Low, color: '#3fa564' },
  ];

  if (total === 0) {
    return (
      <div className="border border-[#dedad0] bg-[#f5f4ef] p-5">
        <div className="mb-4 flex items-center justify-between border-b border-[#dedad0] pb-2">
          <h4 className="font-heading text-lg font-bold uppercase tracking-wider text-[#1b1c1e]">{title}</h4>
        </div>
        <div className="flex h-48 items-center justify-center font-mono text-xs text-neutral-500">
          No severity data recorded
        </div>
      </div>
    );
  }

  // Calculate SVG arc paths
  const radius = 64;
  const strokeWidth = 26;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div className="border border-[#dedad0] bg-[#f5f4ef] p-5 flex flex-col justify-between">
      <div className="mb-4 flex items-center justify-between border-b border-[#dedad0] pb-2">
        <h4 className="font-heading text-lg font-bold uppercase tracking-wider text-[#1b1c1e]">{title}</h4>
        <span className="font-mono text-xs text-neutral-500">Total: {total}</span>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
        {/* SVG Donut */}
        <div className="relative flex items-center justify-center">
          <svg width="170" height="170" viewBox="0 0 170 170" className="-rotate-90">
            {/* Background circle track */}
            <circle
              cx="85"
              cy="85"
              r={radius}
              fill="transparent"
              stroke="#dedad0"
              strokeWidth={strokeWidth}
            />

            {slices.map((slice) => {
              if (slice.value === 0) return null;
              const slicePercent = slice.value / total;
              const strokeDasharray = `${slicePercent * circumference} ${circumference}`;
              const strokeDashoffset = -accumulatedPercent * circumference;
              accumulatedPercent += slicePercent;

              const isHovered = hovered === slice.label;

              return (
                <circle
                  key={slice.label}
                  cx="85"
                  cy="85"
                  r={radius}
                  fill="transparent"
                  stroke={slice.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-300 cursor-pointer"
                  onMouseEnter={() => setHovered(slice.label)}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            })}
          </svg>

          {/* Center Metric */}
          <div className="pointer-events-none absolute flex flex-col items-center justify-center text-center">
            {hovered ? (
              <>
                <span className="font-heading text-2xl font-black tabular-nums text-[#1b1c1e]">
                  {data[hovered]}
                </span>
                <span className="font-mono text-[10px] uppercase font-bold text-neutral-600">
                  {hovered} ({((data[hovered] / total) * 100).toFixed(0)}%)
                </span>
              </>
            ) : (
              <>
                <span className="font-heading text-2xl font-black tabular-nums text-[#1b1c1e]">{total}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">Total</span>
              </>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex sm:flex-col gap-3 font-mono text-xs">
          {slices.map((slice) => {
            const pct = ((slice.value / total) * 100).toFixed(1);
            const isHovered = hovered === slice.label;

            return (
              <div
                key={slice.label}
                className={`flex items-center justify-between gap-4 p-1.5 border transition-all cursor-pointer ${
                  isHovered
                    ? 'border-[#1b1c1e] bg-white shadow-sm'
                    : 'border-transparent hover:border-[#dedad0]'
                }`}
                onMouseEnter={() => setHovered(slice.label)}
                onMouseLeave={() => setHovered(null)}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 border border-black/20"
                    style={{ backgroundColor: slice.color }}
                  ></span>
                  <span className="font-bold text-[#1b1c1e] uppercase tracking-wide">{slice.label}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold tabular-nums text-[#1b1c1e]">{slice.value}</span>
                  <span className="text-neutral-500 ml-1.5 tabular-nums">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
