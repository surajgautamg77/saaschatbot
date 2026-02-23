import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { GitBranchIcon } from './Icons'; // Import the correct icon

interface ConditionNodeData {
  variableName?: string;
  operator?: 'exists' | 'not_exists';
}

export const ConditionNode: React.FC<NodeProps<ConditionNodeData>> = ({ data, isConnectable }) => {
  const variable = data.variableName || '...';
  const opText = data.operator === 'not_exists' ? 'does NOT exist' : 'exists';

  return (
    <div className="bg-pink-900/80 border-2 border-pink-500 rounded-lg p-4 shadow-lg text-white w-64">
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
      
      {/* [+++ NEW HEADER SECTION +++] */}
      <div className="flex flex-col items-center justify-center text-center mb-3">
        <GitBranchIcon className="w-8 h-8 text-pink-300 mb-2" />
        <span className="font-bold text-lg">Condition</span>
        <p className="text-xs text-pink-200 mt-1">Checks a variable and splits the flow based on the result.</p>
      </div>

      {/* [+++ BODY SECTION +++] */}
      <div className="text-center border-t border-pink-400/30 pt-3">
        <div className="text-sm p-2 mt-1 bg-black/20 rounded font-mono">
            If <span className="text-pink-300">{`{{${variable}}}`}</span> {opText}
        </div>
      </div>
      
      {/* [+++ OUTPUTS SECTION +++] */}
      <div className="mt-4 flex justify-between text-sm font-semibold px-2">
        <div className="relative text-right pr-5">
            Yes
            <Handle 
              type="source" 
              position={Position.Right} 
              id="yes"
              style={{ top: '50%', transform: 'translateY(-50%)' }}
              isConnectable={isConnectable} 
            />
        </div>
        <div className="relative text-right pr-5">
            No
            <Handle 
              type="source" 
              position={Position.Right} 
              id="no"
              style={{ top: '50%', transform: 'translateY(-50%)', background: '#fca5a5' }}
              isConnectable={isConnectable} 
            />
        </div>
      </div>
    </div>
  );
};