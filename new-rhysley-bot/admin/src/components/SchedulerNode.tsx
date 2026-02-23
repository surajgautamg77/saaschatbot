

import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { CalendarIcon } from './Icons';

// This node doesn't need any editable data for now, so the data interface is empty.
interface SchedulerNodeData {}

export const SchedulerNode: React.FC<NodeProps<SchedulerNodeData>> = ({ isConnectable }) => {
  return (
    <div className="bg-green-900/80 border-2 border-green-500 rounded-lg p-4 shadow-lg text-white w-64">
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
      
      <div className="flex flex-col items-center justify-center text-center">
        <CalendarIcon className="w-10 h-10 text-green-300 mb-2" />
        <span className="font-bold text-lg">Show Scheduler</span>
        <p className="text-xs text-green-200 mt-1">Stops the flow and displays the booking calendar to the user.</p>
      </div>
      
      <div className="mt-4 space-y-2 text-xs font-semibold">
        <div className="relative text-right pr-5">
            On Confirm
            <Handle 
              type="source" 
              position={Position.Right} 
              id="onConfirm" // Critical: This ID is the sourceHandle
              style={{ top: '65%' }}
              isConnectable={isConnectable} 
            />
        </div>
        <div className="relative text-right pr-5">
            On Cancel
            <Handle 
              type="source" 
              position={Position.Right} 
              id="onCancel" // Critical: This ID is the sourceHandle
              style={{ top: '85%' }}
              isConnectable={isConnectable} 
            />
        </div>
      </div>
    </div>
  );
};