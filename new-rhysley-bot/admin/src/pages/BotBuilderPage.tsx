

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import ReactFlow, {
    Controls, Background, applyNodeChanges, applyEdgeChanges, addEdge,
    Node, Edge, OnNodesChange, OnEdgesChange, OnConnect, Connection, NodeProps, Handle, Position, useReactFlow,
    ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useTourStore } from '../store/useTourStore';
import { HelpCircle } from 'lucide-react';

import { apiClient } from '../api/apiClient';
import { ToolboxPanel } from '../components/ToolboxPanel';
import { NodePropertiesPanel } from '../components/NodePropertiesPanel';
import { MessageNode } from '../components/MessageNode';
import { ChoiceNode } from '../components/ChoiceNode';
import { SchedulerNode } from '../components/SchedulerNode';
import { AiNode } from '../components/AiNode';
import { InputNode } from '../components/InputNode';
import { ConditionNode } from '../components/ConditionNode';

// This is the main component that renders the React Flow canvas
const FlowCanvas: React.FC = () => {
    // Get the botId directly from the URL. This is the single source of truth.
    const { botId } = useParams<{ botId: string }>();
    
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const { screenToFlowPosition } = useReactFlow();
    const startTour = useTourStore(state => state.startTour);

    const customVariables = useMemo(() => {
        return nodes
            .filter(node => node.type === 'inputNode' && node.data.variableName)
            .map(node => node.data.variableName);
    }, [nodes]);

    // This function now correctly fetches the flow for the botId from the URL
    const loadBotFlow = useCallback((id: string) => {
        apiClient.get<any>(`/bots/${id}/flow`)
            .then(data => {
                setNodes(data.nodes || []);
                setEdges(data.edges.map((e: any) => ({
                    id: e.id, source: e.sourceNodeId, target: e.targetNodeId, sourceHandle: e.sourceHandle,
                })));
            })
            .catch(err => {
                setMessage({ text: `Error loading bot flow: ${err.message}`, type: 'error' });
                setNodes([]); setEdges([]);
            });
    }, []);

    // This useEffect hook now correctly depends only on `botId`
    useEffect(() => {
        if (botId) {
            loadBotFlow(botId);
        } else {
            setMessage({ text: "No bot is selected. Please go to the bots list.", type: 'error' });
            setNodes([]); setEdges([]);
        }
        setSelectedNode(null); // Reset selection when bot changes
    }, [botId, loadBotFlow]);

    useEffect(() => {
        if (selectedNode) {
            setSelectedNode(nodes.find(n => n.id === selectedNode.id) || null);
        }
    }, [nodes, selectedNode]);

    const handleUpdateNodeData = useCallback((nodeId: string, newData: any) => {
        setNodes((nds) => nds.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node));
    }, []);

    const nodeTypes = useMemo(() => ({
        messageNode: MessageNode, choiceNode: ChoiceNode, schedulerNode: SchedulerNode,
        aiNode: AiNode, inputNode: InputNode, conditionNode: ConditionNode,
        startNode: ({ isConnectable }: NodeProps) => (
            <div className="bg-teal-900/80 border-2 border-teal-500 rounded-lg p-4 shadow-lg text-white w-48 text-center">
              <span className="font-bold text-lg">Conversation Start</span>
              <p className="text-xs text-teal-200 mt-1">This is the first step of your flow.</p>
              <Handle type="source" position={Position.Right} isConnectable={isConnectable} id="start-source" />
            </div>
          )
    }), []);

    const handleSave = async () => {
        if (!botId) return;
        setIsSaving(true);
        setMessage(null);
        try {
            const nodesToSave = nodes.map(({ data, ...node }) => ({ ...node, data }));
            const formattedEdges = edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle }));
            await apiClient.put(`/bots/${botId}/flow`, { nodes: nodesToSave, edges: formattedEdges });
            setMessage({ text: 'Flow saved successfully!', type: 'success' });
        } catch (err) {
            setMessage({ text: `Failed to save flow: ${err instanceof Error ? err.message : 'Unknown error'}`, type: 'error' });
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };
    
    const onNodesChange: OnNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
    const onEdgesChange: OnEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
    const onConnect: OnConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge(connection, eds)), []);
    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => { setSelectedNode(node); }, []);
    const onPaneClick = useCallback(() => { setSelectedNode(null); }, []);

    const handleDeleteNode = useCallback((nodeId: string) => {
        setNodes((nds) => nds.filter(n => n.id !== nodeId));
        setEdges((eds) => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
        setSelectedNode(null);
    }, []);

    const addNode = useCallback((type: string) => {
        if (!botId) {
            alert("Cannot add node: no bot is selected.");
            return;
        }
        const position = screenToFlowPosition({ x: window.innerWidth / 2.5, y: 150 });
        const newNodeId = `${type}-${Date.now()}`;
        let data;
        switch(type) {
            case 'messageNode': data = { text: 'Type your message...' }; break;
            case 'choiceNode': data = { question: 'Ask a question...', choices: ['Option A'] }; break;
            case 'inputNode': data = { question: 'What is your name?', variableName: 'user_name' }; break;
            case 'conditionNode': data = { variableName: 'user_name', operator: 'exists' }; break;
            case 'aiNode': data = { customPrompt: '' }; break;
            default: data = {};
        }
        const newNode: Node = { id: newNodeId, type, position, data };
        setNodes((nds) => nds.concat(newNode));
    }, [screenToFlowPosition, botId]);

    return (
        <div className="flex h-[calc(100vh-230px)] gap-4 relative">
            <div>
                <ToolboxPanel onAddNode={addNode} />
            </div>
            <div className="flex-1 bg-gray-900 rounded-xl shadow-lg relative">
                <ReactFlow
                    nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
                    nodeTypes={nodeTypes} onNodeClick={onNodeClick} onPaneClick={onPaneClick}
                    fitView nodesDraggable={!!botId} nodesConnectable={!!botId}
                >
                    <Controls />
                    <Background />
                </ReactFlow>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center" data-tour="save-flow-btn">
                    {message && <p className={`text-sm mb-2 px-4 py-1 rounded ${message.type === 'success' ? 'bg-green-600/80 text-white' : 'bg-red-600/80 text-white'}`}>{message.text}</p>}
                    <button onClick={handleSave} disabled={isSaving || !botId} className="px-8 py-3 bg-brand-primary text-black font-semibold rounded-lg hover:bg-yellow-300 disabled:opacity-50">
                        {isSaving ? 'Saving...' : 'Save Flow'}
                    </button>
                </div>

                <button 
                    
                    className="absolute top-4 right-4 z-10 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors"
                    title="Explain this screen"
                >
                    <HelpCircle size={20} />
                </button>
            </div>
            <div data-tour="properties-panel">
                <NodePropertiesPanel 
                selectedNode={selectedNode} 
                onUpdateNodeData={handleUpdateNodeData}
                onDeleteNode={handleDeleteNode}
                customVariables={customVariables}
            />
            </div>  
        </div>
    );
};

// This wrapper component provides the React Flow context
export const BotBuilderPage: React.FC = () => {
    return (
        <ReactFlowProvider>
            <FlowCanvas />
        </ReactFlowProvider>
    );
};