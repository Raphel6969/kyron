import React from 'react';
import { AuditEventItem } from '../services/api';
import { Shield, X, AlertTriangle, Cpu, Brain, CheckCircle2, XOctagon } from 'lucide-react';

interface Props {
  event: AuditEventItem | null;
  onClose: () => void;
}

export const EventForensicDrawer: React.FC<Props> = ({ event, onClose }) => {
  if (!event) return null;

  const isBlocked = event.verdict === 'BLOCK';
  const isAllowed = event.verdict === 'ALLOW';

  const StageCard = ({ label, stage, icon: Icon, color }: any) => {
    const sig = event.matched_signals?.find(s => s.stage === stage);
    const hasSignal = !!sig;
    
    return (
      <div className={`p-3 rounded-xl border ${hasSignal ? `bg-${color}-500/10 border-${color}-500/30` : 'bg-white/5 border-white/10'}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300">
            <Icon className={`w-3.5 h-3.5 ${hasSignal ? `text-${color}-400` : 'text-slate-500'}`} />
            <span>{label}</span>
          </div>
          <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${hasSignal ? `bg-${color}-500/20 text-${color}-300` : 'bg-white/5 text-slate-500'}`}>
            {hasSignal ? (sig.score ? `${Math.round(sig.score * 100)}%` : 'FLAGGED') : 'CLEAR'}
          </span>
        </div>
        {hasSignal && (
          <div className="text-[11px] text-slate-400 font-mono mt-1 border-t border-white/5 pt-1.5">
            <div className="text-white mb-0.5">{sig.signal}</div>
            <div className="opacity-80">{sig.detail}</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 w-[480px] bg-slate-900 border-l border-white/10 z-[101] shadow-2xl flex flex-col animate-in slide-in-from-right-full duration-300">
        
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-teal-400" />
            <h2 className="text-sm font-mono font-bold text-white">Event Forensics</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          <div className="flex items-center justify-between">
            <div className="text-xs font-mono text-slate-400">ID: {event.id}</div>
            <div className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 ${
              isBlocked ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
              isAllowed ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' :
              'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}>
              {isBlocked ? <XOctagon className="w-3.5 h-3.5" /> : 
               isAllowed ? <CheckCircle2 className="w-3.5 h-3.5" /> :
               <AlertTriangle className="w-3.5 h-3.5" />}
              {event.verdict}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
              <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">Agent</div>
              <div className="text-xs text-white font-mono truncate">{event.agent_id}</div>
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
              <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">Tool</div>
              <div className="text-xs text-teal-300 font-mono truncate">{event.tool_name}()</div>
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
              <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">Source</div>
              <div className="text-xs text-slate-300 font-mono truncate">{event.incoming_source}</div>
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
              <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">Timestamp</div>
              <div className="text-xs text-slate-300 font-mono truncate">{new Date(event.timestamp).toLocaleString()}</div>
            </div>
            {event.user_email && (
               <div className="bg-white/5 p-3 rounded-xl border border-white/5 col-span-2">
                 <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">User</div>
                 <div className="text-xs text-slate-300 font-mono truncate">{event.user_email} {event.user_role ? `(${event.user_role})` : ''}</div>
               </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Detection Pipeline</div>
            <StageCard label="Stage 1 — Rule Engine" stage="rule" icon={Shield} color="violet" />
            <StageCard label="Stage 2 — ML Vector" stage="ml" icon={Cpu} color="teal" />
            <StageCard label="Stage 3 — LLM Judge" stage="llm" icon={Brain} color="amber" />
          </div>

          <div className="space-y-2">
             <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Explanation</div>
             <div className="text-xs text-slate-300 bg-black/30 p-3 rounded-xl border border-white/5 leading-relaxed">
               {event.explanation || 'No explanation provided.'}
             </div>
          </div>
          
          {event.policy_check && (
            <div className="space-y-2">
               <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Policy Engine Check</div>
               <div className={`text-xs p-3 rounded-xl border ${event.policy_check.allowed ? 'bg-teal-500/10 border-teal-500/20 text-teal-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
                 <div className="font-bold mb-1">Policy: {event.policy_check.allowed ? 'ALLOW' : 'DENY'}</div>
                 {event.policy_check.reason && <div className="opacity-80 text-[11px] font-mono">{event.policy_check.reason}</div>}
               </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
};
