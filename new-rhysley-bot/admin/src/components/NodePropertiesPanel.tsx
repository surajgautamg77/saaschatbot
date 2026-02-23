

import React, { useState, useEffect } from 'react';
import { Node } from 'reactflow';

interface NodePropertiesPanelProps {
    selectedNode: Node | null;
    onUpdateNodeData: (nodeId: string, data: any) => void;
    onDeleteNode: (nodeId: string) => void;
    customVariables: string[];
}

// These components do not need changes, they can stay as they are.
const systemVariables = ['user_name', 'user_email', 'user_phone'];

const VariableInserter: React.FC<{ onInsert: (variable: string) => void, customVariables: string[] }> = ({ onInsert, customVariables }) => (
    <div className="mt-2">
        <label className="block text-xs font-bold text-gray-400 mb-1">Insert Variable</label>
        <div className="flex flex-wrap gap-2">
            {[...new Set([...systemVariables, ...customVariables])].map(v => (
                <button key={v} onClick={() => onInsert(`{{${v}}}`)} className="px-2 py-1 bg-gray-700 text-xs rounded hover:bg-gray-500">
                    {`{{${v}}}`}
                </button>
            ))}
        </div>
    </div>
);

const VariableSelector: React.FC<{ value: string; onChange: (newValue: string) => void }> = ({ value, onChange }) => {
    const isCustom = !systemVariables.includes(value) && value !== '';
    const selectValue = isCustom ? 'custom' : value;

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedValue = e.target.value;
        if (selectedValue !== 'custom') {
            onChange(selectedValue);
        } else {
            onChange('');
        }
    };

    return (
        <div>
            <label htmlFor="variableName" className="block text-sm font-bold mb-1">Save Answer to Variable</label>
            <select
                value={selectValue}
                onChange={handleSelectChange}
                className="w-full bg-gray-800 rounded p-2 text-sm"
            >
                <option value="">-- Select a Variable --</option>
                <optgroup label="System Variables">
                    {systemVariables.map(v => <option key={v} value={v}>{v}</option>)}
                </optgroup>
                <optgroup label="Other">
                    <option value="custom">Create a new custom variable...</option>
                </optgroup>
            </select>
            {selectValue === 'custom' && (
                <input
                    type="text"
                    placeholder="e.g., order_number"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full bg-gray-800 rounded p-2 text-sm mt-2"
                />
            )}
        </div>
    );
};


export const NodePropertiesPanel: React.FC<NodePropertiesPanelProps> = ({ selectedNode, onUpdateNodeData, onDeleteNode, customVariables }) => {
    // 1. We create a local state to hold the form data while editing.
    const [localData, setLocalData] = useState<any>(null);

    // 2. This effect syncs our local state whenever the selected node changes.
    useEffect(() => {
        if (selectedNode) {
            setLocalData(selectedNode.data);
        } else {
            setLocalData(null);
        }
    }, [selectedNode]);

    // 3. This function updates the main application state in the parent component.
    //    We will call this when an input field loses focus (onBlur).
    const handleBlur = () => {
        if (selectedNode && localData) {
            onUpdateNodeData(selectedNode.id, localData);
        }
    };

    // 4. This function handles changes to input fields, updating only the FAST local state.
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        const checked = (e.target as HTMLInputElement).checked;

        setLocalData((prev: any) => ({
            ...prev,
            [name]: isCheckbox ? checked : value,
        }));
    };

    // This is a special handler for the choices input
    const handleChoicesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target;
        // Update local state as a string for the input field
        setLocalData((prev: any) => ({ ...prev, choices: value }));
    };

    const handleChoicesBlur = () => {
        if (selectedNode && typeof localData.choices === 'string') {
            // On blur, convert the string back to an array and update the main state
            const choicesArray = localData.choices.split(',').map((c: string) => c.trim()).filter(Boolean);
            onUpdateNodeData(selectedNode.id, { ...localData, choices: choicesArray });
        }
    };


    const handleInsertVariable = (textareaName: string, variable: string) => {
        const currentText = localData[textareaName] || '';
        setLocalData((prev: any) => ({
            ...prev,
            [textareaName]: currentText + ' ' + variable
        }));
    };

    if (!selectedNode || !localData) {
        return (
            <div className="w-72 bg-gray-900 rounded-xl shadow-lg p-4 flex flex-col">
                <h3 className="text-lg font-bold text-white mb-4">Properties</h3>
                <div className="flex-grow flex items-center justify-center">
                    <p className="text-gray-400 text-center">Select a node to see its properties.</p>
                </div>
            </div>
        );
    }

    const renderNodeProperties = () => {
        switch (selectedNode.type) {
            case 'messageNode':
                return (
                    <div>
                        <label htmlFor="text" className="block text-sm font-bold mb-1">Message Text</label>
                        <textarea
                            id="text" name="text" value={localData.text}
                            onChange={handleChange} // <-- Update local state
                            onBlur={handleBlur}     // <-- Update global state
                            rows={5} className="w-full bg-gray-800 rounded p-2 text-sm"
                        />
                        <VariableInserter onInsert={(v) => handleInsertVariable('text', v)} customVariables={customVariables} />
                    </div>
                );
            case 'choiceNode':
                //  We now safely handle if choices is an array or string
                const choicesString = Array.isArray(localData.choices) ? localData.choices.join(', ') : localData.choices || '';
                return (
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="question" className="block text-sm font-bold mb-1">Question</label>
                            <textarea
                                id="question" name="question" value={localData.question}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                rows={3} className="w-full bg-gray-800 rounded p-2 text-sm"
                            />
                            <VariableInserter onInsert={(v) => handleInsertVariable('question', v)} customVariables={customVariables} />
                        </div>
                        <div>
                            <label htmlFor="choices" className="block text-sm font-bold mb-1">Choices (comma-separated)</label>
                            <input
                                id="choices" name="choices" type="text"
                                //  Display the joined string
                                value={choicesString}
                                //  Use special handlers for choices
                                onChange={handleChoicesChange}
                                onBlur={handleChoicesBlur}
                                //  Update placeholder text
                                placeholder="Option A, Option B, Option C"
                                className="w-full bg-gray-800 rounded p-2 text-sm"
                            />
                        </div>
                    </div>
                );
            case 'inputNode':
                return (
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="question" className="block text-sm font-bold mb-1">Question to Ask</label>
                            <textarea
                                id="question" name="question" value={localData.question}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                rows={3} className="w-full bg-gray-800 rounded p-2 text-sm"
                            />
                            <VariableInserter onInsert={(v) => handleInsertVariable('question', v)} customVariables={customVariables} />
                        </div>
                        <VariableSelector
                            value={localData.variableName}
                            onChange={(newValue) => {
                                // This is a select, so direct update is fine and won't cause cursor jumps.
                                setLocalData((prev: any) => ({ ...prev, variableName: newValue }));
                                onUpdateNodeData(selectedNode.id, { variableName: newValue });
                            }}
                        />
                    </div>
                );
            case 'aiNode':
                return (
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="customPrompt" className="block text-sm font-bold mb-1">Custom Prompt (Optional)</label>
                            <textarea
                                id="customPrompt" name="customPrompt"
                                value={localData.customPrompt || ''}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                rows={6} className="w-full bg-gray-800 rounded p-2 text-sm"
                                placeholder="Example: Summarize the user's issue based on the chat history. The user's name is {{user_name}}..."
                            />
                            <VariableInserter onInsert={(v) => handleInsertVariable('customPrompt', v)} customVariables={customVariables} />
                        </div>
                        <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-lg">
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="disableKnowledgeBase"
                                    checked={localData.disableKnowledgeBase || false}
                                    // Checkboxes are also safe for direct update
                                    onChange={(e) => {
                                        const checked = e.target.checked;
                                        setLocalData((prev: any) => ({ ...prev, disableKnowledgeBase: checked }));
                                        onUpdateNodeData(selectedNode.id, { disableKnowledgeBase: checked });
                                    }}
                                    className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-red-500 focus:ring-red-600"
                                />
                                <div className="flex-1">
                                    <span className="font-bold text-red-300">Disable Knowledge Base</span>
                                    <p className="text-xs text-red-300/80">Check this to ignore knowledge files for this node.</p>
                                </div>
                            </label>
                        </div>
                    </div>
                );
            // ... other cases like conditionNode can use the same onChange/onBlur pattern for text inputs
            default:
                return <p className="text-gray-400">This node type has no editable properties.</p>;
        }
    };

    return (
        <div className="w-72 bg-gray-900 rounded-xl shadow-lg p-4 flex flex-col">
            <div className="flex-shrink-0 border-b border-gray-700 pb-3 mb-4">
                <h3 className="text-lg font-bold text-white">Properties</h3>
                <p className="text-sm text-cyan-400 font-mono">{selectedNode.type}</p>
            </div>
            <div className="flex-grow overflow-y-auto pr-2">
                {renderNodeProperties()}
            </div>
            {selectedNode.type !== 'startNode' && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                    <button
                        onClick={() => onDeleteNode(selectedNode.id)}
                        className="w-full px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700"
                    >
                        Delete Node
                    </button>
                </div>
            )}
        </div>
    );
};