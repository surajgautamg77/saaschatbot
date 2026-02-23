import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Share2Icon } from './Icons'; // Import the icon

interface ChoiceNodeData {
  question: string;
  choices: string[];
}

export const ChoiceNode: React.FC<NodeProps<ChoiceNodeData>> = ({ data, isConnectable }) => {
  return (
    <div className="bg-purple-900/80 border-2 border-purple-500 rounded-lg p-4 shadow-lg text-white w-64">
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
      
      {/* [+++ NEW HEADER SECTION +++] */}
      <div className="flex flex-col items-center justify-center text-center mb-3">
        <Share2Icon className="w-8 h-8 text-purple-300 mb-2" />
        <span className="font-bold text-lg">Choices</span>
        <p className="text-xs text-purple-200 mt-1">Presents the user with buttons to guide the conversation.</p>
      </div>
      
      {/* [+++ EXISTING LOGIC (SLIGHTLY RESTYLED) +++] */}
      <div className="border-t border-purple-400/30 pt-3">
        <label className="block text-xs font-bold mb-1">Question</label>
        <p className="text-sm p-2 bg-black/20 rounded whitespace-pre-wrap min-h-[40px]">
          {data.question}
        </p>
      </div>
      
      <div className="mt-3 space-y-2 text-sm">
        {data.choices.map((choice, index) => (
          <div key={index} className="relative flex items-center justify-end pr-5 h-6">
            <span className="text-xs font-semibold">{choice}</span>
            <Handle 
              type="source" position={Position.Right} id={choice}
              style={{ top: '50%', transform: 'translateY(-50%)' }}
              isConnectable={isConnectable} 
            />
          </div>
        ))}
        <div className="relative flex items-center justify-end pr-5 h-6 border-t border-purple-400/30 mt-2 pt-2">
          <span className="text-xs text-purple-300 italic">Default</span>
          <Handle
            type="source" position={Position.Right} id="default"
            style={{ top: '50%', transform: 'translateY(-50%)', background: '#a78bfa' }}
            isConnectable={isConnectable}
          />
        </div>
      </div>
    </div>
  );
};