

import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

interface MessageNodeData {
  text: string;
}

export const MessageNode: React.FC<NodeProps<MessageNodeData>> = ({ data, isConnectable }) => {
  const displayText = data.text.length > 50 ? data.text.substring(0, 50) + '...' : data.text;
  return (
    <div className="bg-blue-900/80 border-2 border-blue-500 rounded-lg p-3 shadow-lg text-white w-64">
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
      <div>
        <div className="text-xs font-bold mb-1">Show Message</div>
        <p className="text-sm p-2 bg-black/20 rounded min-h-[40px] whitespace-pre-wrap">{displayText}</p>
      </div>
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} />
    </div>
  );
};