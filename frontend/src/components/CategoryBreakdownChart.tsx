import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AuditEventItem } from '../services/api';

interface Props {
  events: AuditEventItem[];
}

const COLORS = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9'];

export const CategoryBreakdownChart: React.FC<Props> = ({ events }) => {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach(event => {
      if (event.verdict === 'BLOCK' && event.matched_signals) {
        event.matched_signals.forEach(sig => {
          if (sig.detail) {
            const match = sig.detail.match(/known '(.*?)' attack/i) || sig.detail.match(/known (.*?) attack/i);
            if (match && match[1]) {
              const cat = match[1];
              counts[cat] = (counts[cat] || 0) + 1;
            } else {
               const ruleMatch = sig.signal;
               if (ruleMatch) {
                 counts[ruleMatch] = (counts[ruleMatch] || 0) + 1;
               }
            }
          } else if (sig.signal) {
             counts[sig.signal] = (counts[sig.signal] || 0) + 1;
          }
        });
      }
    });
    
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [events]);

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-center h-full min-h-[200px]">
      <div className="text-xs font-mono text-slate-400 mb-2 uppercase tracking-wider">Top Blocked Categories</div>
      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs font-mono text-slate-500">No data</div>
      ) : (
        <div className="flex-1 w-full h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <Tooltip 
                cursor={{ fill: '#ffffff10' }} 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc', fontSize: '12px', fontFamily: 'monospace' }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
