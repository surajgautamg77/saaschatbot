

import React from 'react';
import { CalendarIcon, MessageSquareIcon, SparklesIcon, Share2Icon, TypeIcon, GitBranchIcon } from './Icons';

interface ToolboxPanelProps {
    onAddNode: (type: string) => void;
}

// We define a style map so Tailwind's JIT compiler can see the full class names.
const nodeStyles: { [key: string]: { button: string; icon: string } } = {
    messageNode:   { button: 'bg-blue-600/20 hover:border-blue-500',   icon: 'text-blue-400' },
    choiceNode:    { button: 'bg-purple-600/20 hover:border-purple-500', icon: 'text-purple-400' },
    inputNode:     { button: 'bg-orange-600/20 hover:border-orange-500', icon: 'text-orange-400' },
    conditionNode: { button: 'bg-pink-600/20 hover:border-pink-500',     icon: 'text-pink-400' },
    schedulerNode: { button: 'bg-green-600/20 hover:border-green-500',   icon: 'text-green-400' },
    aiNode:        { button: 'bg-sky-600/20 hover:border-sky-500',       icon: 'text-sky-400' }
};

const nodeTypes = [
    { type: 'messageNode',   label: 'Show Message',   icon: MessageSquareIcon },
    { type: 'choiceNode',    label: 'Choices',        icon: Share2Icon },
    { type: 'inputNode',     label: 'Capture Input',  icon: TypeIcon },
    { type: 'conditionNode', label: 'Condition',      icon: GitBranchIcon },
    { type: 'schedulerNode', label: 'Show Scheduler', icon: CalendarIcon },
    { type: 'aiNode',        label: 'AI Response',    icon: SparklesIcon }
];

export const ToolboxPanel: React.FC<ToolboxPanelProps> = ({ onAddNode }) => {
    return (
        <div data-tour="toolbox-panel" className="w-64 bg-gray-900 rounded-xl shadow-lg p-4 flex flex-col gap-3">
            <h3 className="text-lg font-bold text-white mb-2">Flow Nodes</h3>
            <div className="grid grid-cols-2 gap-3">
                {nodeTypes.map(({ type, label, icon: Icon }) => {
                    const styles = nodeStyles[type];
                    return (
                        <button
                            key={type}
                            onClick={() => onAddNode(type)}
                            // Apply the full classes from our style map
                            className={`p-3 text-white rounded-lg border-2 border-transparent transition-all flex flex-col items-center justify-center gap-2 aspect-square ${styles.button}`}
                            title={`Add a "${label}" node`}
                        >
                            <Icon className={`w-8 h-8 ${styles.icon}`} />
                            <span className="text-xs font-semibold text-center">{label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};