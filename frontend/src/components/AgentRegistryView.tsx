import React, { useState, useEffect } from "react";
import { Cpu, ShieldAlert, TrendingUp, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { fetchAgentLeaderboard, AgentRegistryEntry } from "../services/api";

export const AgentRegistryView: React.FC = () => {
  const [agents, setAgents] = useState<AgentRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"block_rate" | "total_calls" | "avg_risk_score">("block_rate");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAgentLeaderboard();
      setAgents(data.leaderboard || []);
    } catch { setAgents([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const sorted = [...agents].sort((a, b) => {
    const diff = a[sortBy] - b[sortBy];
    return sortDir === "desc" ? -diff : diff;
  });
  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(col); setSortDir("desc"); }
  };
  const blockColor = (r: number) => r >= 70 ? "text-rose-400" : r >= 30 ? "text-amber-400" : "text-teal-400";
  const barColor   = (r: number) => r >= 70 ? "bg-rose-500" : r >= 40 ? "bg-amber-500" : r >= 10 ? "bg-orange-500" : "bg-teal-500";
  const riskColor  = (s: number) => s >= 0.7 ? "text-rose-400" : s >= 0.4 ? "text-amber-400" : "text-teal-400";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 rounded-2xl bg-slate-900/80 border border-white/10">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-teal-400" /> Agent Registry
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">All agents screened through Kyron — ranked by risk profile.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold font-mono">{agents.length} agents</span>
          <button onClick={load} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {agents.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Agents", value: agents.length, color: "text-teal-300" },
            { label: "High-Risk Agents", value: agents.filter(a => a.block_rate >= 70).length, color: "text-rose-300" },
            { label: "Avg Block Rate", value: `${(agents.reduce((s,a)=>s+a.block_rate,0)/agents.length).toFixed(1)}%`, color: "text-amber-300" },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-4 rounded-xl bg-slate-900/60 border border-white/10 text-center">
              <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm font-mono">Loading registry...</div>
      ) : agents.length === 0 ? (
        <div className="text-center py-16"><Cpu className="w-10 h-10 text-slate-600 mx-auto mb-3" /><p className="text-sm text-slate-400 font-mono">No agents yet. Run screenings to populate.</p></div>
      ) : (
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left p-4 text-[10px] text-slate-400 uppercase tracking-wider font-bold">Agent ID</th>
                {(["total_calls", "block_rate", "avg_risk_score"] as const).map(col => (
                  <th key={col} className="text-right p-4 text-[10px] text-slate-400 uppercase tracking-wider font-bold cursor-pointer hover:text-white select-none" onClick={() => toggleSort(col)}>
                    <span className="flex items-center justify-end gap-1">
                      {col === "total_calls" ? "Calls" : col === "block_rate" ? "Block Rate" : "Avg Risk"}
                      {sortBy === col ? (sortDir === "desc" ? <ChevronDown className="w-3 h-3 text-teal-400" /> : <ChevronUp className="w-3 h-3 text-teal-400" />) : <ChevronDown className="w-3 h-3 opacity-30" />}
                    </span>
                  </th>
                ))}
                <th className="text-right p-4 text-[10px] text-slate-400 uppercase tracking-wider font-bold">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((agent, idx) => (
                <tr key={agent.agent_id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${barColor(agent.block_rate)}`} />
                      <div>
                        <code className="text-xs font-bold text-white font-mono">{agent.agent_id}</code>
                        {idx === 0 && agent.block_rate >= 50 && <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">HIGHEST RISK</span>}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right font-mono text-slate-200">{agent.total_calls.toLocaleString()}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full rounded-full ${barColor(agent.block_rate)}`} style={{ width: `${Math.min(agent.block_rate,100)}%` }} /></div>
                      <span className={`font-mono font-bold ${blockColor(agent.block_rate)}`}>{agent.block_rate.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="p-4 text-right"><span className={`font-mono font-bold ${riskColor(agent.avg_risk_score)}`}>{(agent.avg_risk_score*100).toFixed(1)}%</span></td>
                  <td className="p-4 text-right font-mono text-[10px] text-slate-400">{agent.last_seen ? new Date(agent.last_seen).toLocaleTimeString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
