import React, { useState } from 'react';

interface BarChartItem {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartItem[];
  title: string;
  height?: number;
  unit?: string;
  horizontal?: boolean;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  title,
  height = 240,
  unit = 'events',
  horizontal = false,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-56 flex-col items-center justify-center border border-[#dedad0] bg-[#f5f4ef] p-6 text-center">
        <p className="font-mono text-xs uppercase tracking-wider text-neutral-500">No data points logged</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  if (horizontal) {
    return (
      <div className="border border-[#dedad0] bg-[#f5f4ef] p-5">
        <div className="mb-4 flex items-center justify-between border-b border-[#dedad0] pb-2">
          <h4 className="font-heading text-lg font-bold uppercase tracking-wider text-[#1b1c1e]">{title}</h4>
          <span className="font-mono text-xs text-neutral-500">{data.length} categories</span>
        </div>

        <div className="space-y-3">
          {data.map((item, idx) => {
            const pct = (item.value / maxValue) * 100;
            const isHovered = hoveredIdx === idx;
            const barColor = item.color || '#1b1c1e';

            return (
              <div
                key={item.label}
                className="group relative cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <div className="mb-1 flex items-center justify-between font-mono text-xs">
                  <span className="truncate pr-2 font-medium text-[#1b1c1e]">{item.label}</span>
                  <span className="font-bold tabular-nums text-neutral-800">
                    {item.value} {unit}
                  </span>
                </div>
                <div className="relative h-6 w-full overflow-hidden bg-[#e5e2d8] border border-[#dedad0]">
                  {/* Subtle technical grid marks */}
                  <div className="absolute inset-0 flex justify-between px-1 opacity-20">
                    <span className="border-r border-black h-full"></span>
                    <span className="border-r border-black h-full"></span>
                    <span className="border-r border-black h-full"></span>
                    <span className="border-r border-black h-full"></span>
                  </div>
                  <div
                    className="h-full transition-all duration-500 ease-out flex items-center justify-end pr-2"
                    style={{
                      width: `${Math.max(pct, 3)}%`,
                      backgroundColor: isHovered ? '#f5c518' : barColor,
                    }}
                  >
                    {pct > 15 && (
                      <span className="font-mono text-[10px] font-bold text-white drop-shadow-sm tabular-nums">
                        {item.value}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Vertical Bar Chart
  const chartHeight = height - 70;
  const colWidth = Math.min(60, Math.floor(400 / Math.max(data.length, 1)));

  return (
    <div className="border border-[#dedad0] bg-[#f5f4ef] p-5 flex flex-col justify-between">
      <div className="mb-3 flex items-center justify-between border-b border-[#dedad0] pb-2">
        <h4 className="font-heading text-lg font-bold uppercase tracking-wider text-[#1b1c1e]">{title}</h4>
        <span className="font-mono text-xs text-neutral-500">Max: {maxValue}</span>
      </div>

      <div className="relative w-full" style={{ height: `${chartHeight}px` }}>
        {/* Background grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-30">
          <div className="border-b border-[#1b1c1e] w-full flex justify-end pr-1 text-[10px] font-mono">
            {maxValue}
          </div>
          <div className="border-b border-[#1b1c1e] w-full flex justify-end pr-1 text-[10px] font-mono">
            {Math.round(maxValue / 2)}
          </div>
          <div className="border-b border-[#1b1c1e] w-full flex justify-end pr-1 text-[10px] font-mono">0</div>
        </div>

        {/* Bars Container */}
        <div className="relative h-full flex items-end justify-around gap-2 px-6 pt-4 pb-1">
          {data.map((item, idx) => {
            const heightPct = (item.value / maxValue) * 100;
            const isHovered = hoveredIdx === idx;
            const barColor = item.color || '#1b1c1e';

            return (
              <div
                key={item.label}
                className="group relative flex flex-1 max-w-[80px] h-full flex-col items-center justify-end cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Tooltip on hover */}
                {isHovered && (
                  <div className="absolute -top-10 z-20 whitespace-nowrap bg-[#1b1c1e] px-2 py-1 font-mono text-[11px] text-[#f5c518] shadow-md border border-[#f5c518]">
                    {item.label}: <strong className="text-white">{item.value}</strong>
                  </div>
                )}

                <div
                  className="w-full transition-all duration-500 ease-out border-t-2 border-x border-[#dedad0]"
                  style={{
                    height: `${Math.max(heightPct, 4)}%`,
                    backgroundColor: isHovered ? '#f5c518' : barColor,
                  }}
                >
                  <div className="w-full text-center pt-1 font-mono text-[10px] font-bold text-white">
                    {item.value > 0 ? item.value : ''}
                  </div>
                </div>

                <div className="mt-2 w-full truncate text-center font-mono text-[11px] text-neutral-700" title={item.label}>
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
