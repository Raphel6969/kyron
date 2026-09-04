import React, { useState, useEffect } from 'react';
import { fetchPendingApprovals, decideApproval, PendingApproval } from '../services/api';
import { useToast } from './ToastSystem';
import { Shield, Clock, CheckCircle2, XOctagon, User, Cpu, AlertTriangle } from 'lucide-react';

export const ApprovalQueueView: React.FC = () => {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const toast = useToast();

  const loadApprovals = async () => {
    try {
      const data = await fetchPendingApprovals();
      setApprovals(data.pending || []);
    } catch (err) {
      toast.error('Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
    const interval = setInterval(loadApprovals, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleDecide = async (id: number, approved: boolean) => {
    try {
      await decideApproval(id, approved, reason);
      toast.success(`Action ${approved ? 'approved' : 'denied'} successfully`);
      setApprovals(prev => prev.filter(a => a.id !== id));
      setReviewingId(null);
      setReason('');
    } catch (err) {
      toast.error('Decision failed');
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400 font-mono text-xs">Loading queue...</div>;

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          Pending Approvals
        </h2>
        <div className="text-xs font-mono text-slate-400">{approvals.length} items in queue</div>
      </div>

      {approvals.length === 0 ? (
        <div className="text-center p-12 bg-white/5 border border-white/10 rounded-2xl">
          <Shield className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-slate-300 font-bold mb-1">Queue Clear</h3>
          <p className="text-slate-500 text-xs font-mono">No pending requests requiring approval.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map(app => (
            <div key={app.id} className="bg-slate-900/80 border border-amber-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/50" />
              
              <div className="flex flex-col sm:flex-row gap-5">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-indigo-400" />
                      <span className="text-sm font-bold text-slate-200">{app.agent_id}</span>
                      <span className="text-xs text-slate-500">requested</span>
                      <span className="text-sm font-mono text-teal-300 font-bold bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">{app.tool_name}()</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(app.timestamp).toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-black/30 rounded-xl p-3 border border-white/5 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] uppercase font-mono text-slate-500">Explanation</span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                        Risk: {app.risk_score.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-sm text-slate-300">{app.explanation}</div>
                    {app.llm_reasoning && (
                      <div className="mt-2 text-xs text-amber-200/80 italic border-l-2 border-amber-500/30 pl-3">
                        "{app.llm_reasoning}"
                      </div>
                    )}
                  </div>

                  {(app.user_email || app.user_role) && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 bg-white/5 px-3 py-1.5 rounded-lg w-fit">
                      <User className="w-3.5 h-3.5" />
                      <span>{app.user_email}</span>
                      {app.user_role && <span className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px]">{app.user_role}</span>}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 min-w-[200px]">
                  {reviewingId === app.id ? (
                    <div className="flex flex-col gap-2 h-full justify-center">
                      <input 
                        type="text" 
                        placeholder="Reason (optional)" 
                        value={reason} 
                        onChange={e => setReason(e.target.value)}
                        className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleDecide(app.id, true)} className="flex-1 flex items-center justify-center gap-1.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 rounded-lg px-3 py-2 text-xs font-bold transition-colors">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button onClick={() => handleDecide(app.id, false)} className="flex-1 flex items-center justify-center gap-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg px-3 py-2 text-xs font-bold transition-colors">
                          <XOctagon className="w-3.5 h-3.5" /> Deny
                        </button>
                      </div>
                      <button onClick={() => setReviewingId(null)} className="text-[10px] text-slate-500 hover:text-slate-300 mt-1 uppercase tracking-wider font-mono">Cancel</button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setReviewingId(app.id)}
                      className="h-full flex flex-col items-center justify-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl p-4 transition-all"
                    >
                      <Shield className="w-6 h-6" />
                      <span className="text-sm font-bold">Review & Decide</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
