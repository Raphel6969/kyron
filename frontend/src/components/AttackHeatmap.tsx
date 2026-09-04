import React from "react";
import { AuditEventItem } from "../services/api";

interface AttackHeatmapProps {
  events: AuditEventItem[];
}

export const AttackHeatmap: React.FC<AttackHeatmapProps> = ({ events }) => {
  // Aggregate events by day of week (0-6) and time block (0-3: night, morning, afternoon, evening)
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const periods = ["00-06h", "06-12h", "12-18h", "18-24h"];

  const matrix: { total: number; blocked: number }[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 4 }, () => ({ total: 0, blocked: 0 }))
  );

  events.forEach((e) => {
    if (!e.timestamp) return;
    const d = new Date(e.timestamp);
    const day = d.getDay();
    const hour = d.getHours();
    const period = Math.floor(hour / 6);
    if (day >= 0 && day < 7 && period >= 0 && period < 4) {
      matrix[day][period].total += 1;
      if (e.verdict === "block") matrix[day][period].blocked += 1;
    }
  });

  const getCellColor = (total: number, blocked: number) => {
    if (total === 0) return "bg-slate-900/60 border-white/5";
    if (blocked > 0) {
      if (blocked >= 5) return "bg-rose-500/80 border-rose-400/50 text-white font-bold";
      if (blocked >= 2) return "bg-rose-500/50 border-rose-400/30 text-rose-200";
      return "bg-rose-500/30 border-rose-400/20 text-rose-300";
    }
    if (total >= 4) return "bg-teal-500/50 border-teal-400/30 text-teal-200";
    return "bg-teal-500/25 border-teal-400/20 text-teal-300";
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
            Threat Heatmap (Weekly Velocity)
          </h4>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            Hourly distribution of security events by day of week
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-slate-800 border border-white/10" /> None</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-teal-500/30 border border-teal-500/40" /> Clear</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-rose-500/70 border border-rose-400/50" /> Attacks</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[340px]">
          <div className="grid grid-cols-5 gap-1.5 mb-1.5 text-[9px] font-mono text-slate-500 text-center">
            <div className="text-left pl-1">DAY</div>
            {periods.map((p) => (
              <div key={p}>{p}</div>
            ))}
          </div>

          {days.map((dayName, dIdx) => (
            <div key={dayName} className="grid grid-cols-5 gap-1.5 mb-1.5 items-center">
              <span className="text-[10px] font-mono font-bold text-slate-400 pl-1">{dayName}</span>
              {periods.map((_, pIdx) => {
                const cell = matrix[dIdx][pIdx];
                return (
                  <div
                    key={pIdx}
                    title={`${dayName} ${periods[pIdx]}: ${cell.total} events (${cell.blocked} blocked)`}
                    className={`h-7 rounded-lg border flex items-center justify-center text-[10px] font-mono transition-all hover:scale-105 cursor-pointer ${getCellColor(
                      cell.total,
                      cell.blocked
                    )}`}
                  >
                    {cell.total > 0 ? (
                      <span>{cell.blocked > 0 ? `!${cell.blocked}` : cell.total}</span>
                    ) : (
                      <span className="text-slate-700">·</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
