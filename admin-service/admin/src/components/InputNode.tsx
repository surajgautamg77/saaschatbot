

import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

interface InputNodeData {
  question: string;
  variableName: string;
}

export const InputNode: React.FC<NodeProps<InputNodeData>> = ({ data, isConnectable }) => {
  return (
    <div className="bg-orange-900/80 border-2 border-orange-500 rounded-lg p-3 shadow-lg text-white w-64 space-y-2">
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
      
      <div>
        <label className="block text-xs font-bold mb-1">Question to Ask</label>
        <p className="text-sm p-2 bg-black/20 rounded whitespace-pre-wrap">
          {data.question || '(not set)'}
        </p>
      </div>
      <div>
        <label className="block text-xs font-bold mb-1">Save Answer to Variable</label>
        <p className="text-sm p-2 bg-black/20 rounded font-mono text-orange-300">
          {`{{${data.variableName || ''}}}`}
        </p>
      </div>
      
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} />
    </div>
  );
};