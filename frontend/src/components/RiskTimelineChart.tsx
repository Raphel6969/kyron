import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { Shield, Activity, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';

interface AuditItem {
  id: number;
  timestamp: string;
  tool_name: string;
  agent_id: string;
  risk_score: number;
  verdict: 'allow' | 'block' | 'require_approval';
  explanation?: string;
  user_email?: string;
}

interface RiskTimelineChartProps {
  events: AuditItem[];
  title?: string;
}

export const RiskTimelineChart: React.FC<RiskTimelineChartProps> = ({
  events,
  title = "Real-Time Interception Risk Timeline"
}) => {
  // Format the last 25 events (chronological order for the graph)
  const chartData = React.useMemo(() => {
    if (!events || events.length === 0) {
      // Return synthetic baseline if no events logged yet
      return [
        { index: 1, time: 'Init', risk: 0.05, verdict: 'allow', tool: 'system_boot' },
        { index: 2, time: '+2s', risk: 0.12, verdict: 'allow', tool: 'search_web' },
        { index: 3, time: '+5s', risk: 0.88, verdict: 'block', tool: 'write_file' },
        { index: 4, time: '+8s', risk: 0.22, verdict: 'allow', tool: 'read_file' },
        { index: 5, time: '+12s', risk: 0.95, verdict: 'block', tool: 'execute_code' },
      ];
    }

    // Take up to last 30 events, reverse to show chronological (left to right)
    const recent = [...events].slice(0, 30).reverse();
    return recent.map((item, idx) => {
      let timeLabel = '';
      try {
        const d = new Date(item.timestamp);
        timeLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      } catch {
        timeLabel = `#${item.id}`;
      }

      return {
        index: idx + 1,
        id: item.id,
        time: timeLabel,
        risk: Number(item.risk_score.toFixed(2)),
        verdict: item.verdict,
        tool: item.tool_name || 'unknown',
        agent: item.agent_id || 'unknown',
        user: item.user_email || 'kyron_agent',
        explanation: item.explanation || ''
      };
    });
  }, [events]);

  // Compute metrics
  const avgRisk = chartData.length > 0
    ? (chartData.reduce((acc, curr) => acc + curr.risk, 0) / chartData.length).toFixed(2)
    : '0.00';

  const blockCount = chartData.filter(d => d.verdict === 'block').length;
  const allowCount = chartData.filter(d => d.verdict === 'allow').length;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isBlock = data.verdict === 'block';
      const isApproval = data.verdict === 'require_approval';

      return (
        <div className="p-3 rounded-xl bg-slate-950/95 border border-white/20 shadow-2xl backdrop-blur-xl text-xs font-mono text-slate-200 min-w-[220px]">
          <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-white/10">
            <span className="text-[10px] text-slate-400">{data.time}</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                isBlock
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : isApproval
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
              }`}
            >
              {data.verdict}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Risk Score:</span>
              <span className={`font-black ${isBlock ? 'text-rose-400' : 'text-teal-300'}`}>
                {data.risk.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Tool:</span>
              <span className="text-white font-semibold">{data.tool}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Agent:</span>
              <span className="text-slate-300">{data.agent}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 shadow-2xl backdrop-blur-xl">
      {/* Header telemetry info */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>{title}</span>
              <span className="flex items-center gap-1 text-[10px] text-teal-400 font-mono px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
                <span>LIVE</span>
              </span>
            </h4>
            <p className="text-[11px] text-slate-400 font-mono">
              Real-time cascade risk score evaluation across recent agent calls
            </p>
          </div>
        </div>

        {/* Mini stats badges */}
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <div className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 flex items-center gap-1.5">
            <span className="text-slate-400">Avg Risk:</span>
            <span className="font-bold text-teal-300">{avgRisk}</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center gap-1.5">
            <ShieldAlert className="w-3 h-3 text-rose-400" />
            <span className="text-slate-400">Blocked:</span>
            <span className="font-bold text-rose-400">{blockCount}</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3 text-teal-400" />
            <span className="text-slate-400">Allowed:</span>
            <span className="font-bold text-teal-300">{allowCount}</span>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-44 sm:h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.5} />
                <stop offset="50%" stopColor="#14b8a6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

            <XAxis
              dataKey="time"
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
            />

            <YAxis
              domain={[0, 1]}
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              ticks={[0, 0.4, 0.7, 1.0]}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Threshold lines */}
            <ReferenceLine y={0.70} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: 'BLOCK (0.70)', fill: '#f43f5e', fontSize: 9, position: 'insideTopRight' }} />
            <ReferenceLine y={0.40} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'REVIEW (0.40)', fill: '#f59e0b', fontSize: 9, position: 'insideTopRight' }} />

            <Area
              type="monotone"
              dataKey="risk"
              stroke="#14b8a6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#riskGradient)"
              isAnimationActive={true}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
