import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface Props {
  blocked: number;
  allowed: number;
  requiresApproval: number;
}

export const VerdictDonutChart: React.FC<Props> = ({ blocked, allowed, requiresApproval }) => {
  const data = [
    { name: 'Blocked', value: blocked, color: '#f43f5e' }, // rose-500
    { name: 'Allowed', value: allowed, color: '#14b8a6' }, // teal-500
    { name: 'Requires Approval', value: requiresApproval, color: '#f59e0b' } // amber-500
  ].filter(d => d.value > 0);

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-center h-full min-h-[200px]">
      <div className="text-xs font-mono text-slate-400 mb-2 uppercase tracking-wider">Verdict Distribution</div>
      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs font-mono text-slate-500">No data</div>
      ) : (
        <div className="flex-1 w-full h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                innerRadius={40}
                outerRadius={60}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc', fontSize: '12px', fontFamily: 'monospace' }}
                itemStyle={{ color: '#f8fafc' }}
              />
              <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
