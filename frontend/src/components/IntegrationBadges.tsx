import React from 'react';

const INTEGRATIONS = [
  { name: 'LangChain', emoji: '🦜' },
  { name: 'CrewAI', emoji: '👥' },
  { name: 'OpenAI Agents', emoji: '⚡' },
  { name: 'AutoGen', emoji: '🤖' },
  { name: 'Amazon Bedrock', emoji: '☁️' },
  { name: 'Google ADK', emoji: '🔮' },
  { name: 'Hugging Face', emoji: '🤗' },
  { name: 'FastAPI', emoji: '⚡' },
];

export const IntegrationBadges: React.FC = () => {
  return (
    <section className="py-12 border-y border-white/5 bg-white/[0.01]">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <h3 className="text-sm font-mono text-slate-400 mb-6 uppercase tracking-widest">
          Integrates with the entire agentic AI ecosystem
        </h3>
        <div className="flex flex-wrap justify-center gap-3">
          {INTEGRATIONS.map((integ, i) => (
            <div 
              key={i} 
              className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 hover:bg-white/10 hover:border-white/20 transition-all cursor-default"
            >
              <span className="text-lg">{integ.emoji}</span>
              <span className="text-sm font-mono text-slate-300 font-semibold">{integ.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
