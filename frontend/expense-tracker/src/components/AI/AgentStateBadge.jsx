import React from 'react';
import { LuSparkles, LuLoader } from 'react-icons/lu';

export const AgentStateBadge = ({ stateText = 'Parsing query...' }) => {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-medium animate-pulse my-2">
      <LuLoader className="animate-spin text-indigo-400 text-sm" />
      <LuSparkles className="text-indigo-400 text-xs" />
      <span>{stateText}</span>
    </div>
  );
};

export default AgentStateBadge;
