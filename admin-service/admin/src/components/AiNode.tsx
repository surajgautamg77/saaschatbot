

import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { SparklesIcon } from './Icons';

interface AiNodeData {
  customPrompt?: string;
  disableKnowledgeBase?: boolean;
}

export const AiNode: React.FC<NodeProps<AiNodeData>> = ({ data, isConnectable }) => {
    const hasCustomPrompt = data.customPrompt && data.customPrompt.trim() !== '';
    const isKbDisabled = data.disableKnowledgeBase === true;

    let mode = 'RAG Only';
    let description = "Generates an answer using the knowledge base.";
    let borderColor = 'border-sky-500';
    let iconColor = 'text-sky-300';

    if (isKbDisabled) {
        mode = 'Prompt Only';
        description = "Generates a response using only the custom prompt. Knowledge base is disabled.";
        borderColor = 'border-red-500';
        iconColor = 'text-red-300';
    } else if (hasCustomPrompt) {
        mode = 'Augmented RAG';
        description = "Uses the knowledge base, but follows additional instructions from your custom prompt.";
        borderColor = 'border-yellow-400';
        iconColor = 'text-yellow-300';
    }

  return (
    <div className={`bg-sky-900/80 border-2 rounded-lg p-4 shadow-lg text-white w-64 ${borderColor}`}>
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
      
      <div className="flex flex-col items-center justify-center text-center">
        <SparklesIcon className={`w-10 h-10 mb-2 ${iconColor}`} />
        <span className="font-bold text-lg">AI Response</span>
        <div className={`text-xs font-bold px-2 py-0.5 rounded-full mt-1 ${isKbDisabled ? 'bg-red-900/50' : hasCustomPrompt ? 'bg-yellow-900/50' : 'bg-sky-900/50'}`}>
            {mode}
        </div>
        <p className="text-xs text-sky-200 mt-2">{description}</p>
        
        {hasCustomPrompt && (
            <div className="mt-2 text-left w-full bg-black/20 p-2 rounded text-xs">
                <p className="font-semibold text-yellow-300">Custom Prompt:</p>
                <p className="italic opacity-80 truncate">{data.customPrompt}</p>
            </div>
        )}
      </div>
      
      <div className="mt-4 space-y-2 text-xs font-semibold">
        <div className="relative text-right pr-5">
            On Response
            <Handle 
              type="source" 
              position={Position.Right} 
              id="onResponse"
              style={{ top: 'auto', bottom: '15px' }}
              isConnectable={isConnectable} 
            />
        </div>
      </div>
    </div>
  );
};