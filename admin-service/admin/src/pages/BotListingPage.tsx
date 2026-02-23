import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, PlusCircle, Trash2, SquarePen, SquareCode, Check, X, Settings } from 'lucide-react';
import { toast } from 'react-toastify';
import { apiClient } from '../api/apiClient';
import { CreateBotModal } from '../components/CreateBotModal';

interface Bot {
    id: string;
    name: string;
    publicApiKey: string;
}

export const BotListingPage: React.FC = () => {
    const [bots, setBots] = useState<Bot[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBotId, setEditingBotId] = useState<string | null>(null);
    const [editedBotName, setEditedBotName] = useState<string>('');
    const navigate = useNavigate();

    const fetchBots = useCallback(async () => {
        setIsLoading(true);
        try {
            const botsData = await apiClient.get<Bot[]>('/bots');
            setBots(botsData);
        } catch (err) {
            console.error('Error fetching bots:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBots();
    }, [fetchBots]);

    const handleCreateBot = async (name: string) => {
        try {
            const newBot = await apiClient.post<Bot>('/bots', { name });
            navigate(`/bot/${newBot.id}/builder`);
        } catch (err: any) {
            const responseData = err.response?.data;
            if (responseData && responseData.message && responseData.botName) {
                const messageParts = responseData.message.split(responseData.botName);
                toast.error(
                    <div>
                        {messageParts[0]}
                        <span className="font-bold text-blue-300">{responseData.botName}</span>
                        {messageParts[1]}
                    </div>
                );
            } else {
                const errorMessage = responseData?.message || err.message || 'Failed to create bot';
                toast.error(errorMessage);
            }
        } finally {
            setIsModalOpen(false);
        }
    };

    const handleDeleteBot = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this bot? This action is permanent.")) {
            try {
                await apiClient.delete(`/bots/${id}`);
                fetchBots();
            } catch (err) {
                alert(`Failed to delete bot: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
        }
    };

    const handleUpdateBotName = async (botId: string) => {
        if (!editedBotName.trim()) {
            setEditingBotId(null);
            return;
        }
        try {
            await apiClient.put(`/bots/${botId}`, { name: editedBotName });
            setBots(prevBots => prevBots.map(bot => bot.id === botId ? { ...bot, name: editedBotName } : bot));
            toast.success('Bot name updated successfully!');
        } catch (err: any) {
            const responseData = err.response?.data;
            if (responseData && responseData.message && responseData.botName) {
                const messageParts = responseData.message.split(responseData.botName);
                toast.error(
                    <div>
                        {messageParts[0]}
                        <span className="font-bold text-blue-300">{responseData.botName}</span>
                        {messageParts[1]}
                    </div>
                );
            } else {
                const errorMessage = responseData?.message || err.message || 'Failed to update bot name';
                toast.error(errorMessage);
            }
        } finally {
            setEditingBotId(null);
            setEditedBotName('');
        }
    };

    const widgetSrc = `${window.location.origin}/client/widget.js`;

    const handleCopy = (apiKey: string) => {
        const embedCode = `<script type="module" src="${widgetSrc}" data-company-key="${apiKey}"></script>`;
        navigator.clipboard.writeText(embedCode);
        alert('Embed code copied to clipboard!');
    };

    return (
        <div className="p-4 md:p-6 lg:p-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-white tracking-tight">Your Bots</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    data-tour="create-bot-btn"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-lg hover:bg-blue-500 transition-all duration-300 transform hover:scale-105"
                >
                    <PlusCircle size={20} />
                    <span>Create New Bot</span>
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <p className="text-center text-gray-400">Loading your bots...</p>
                </div>
            ) : bots.length === 0 ? (
                <div className="text-center py-16 bg-gray-900/50 rounded-lg border border-dashed border-gray-700">
                    <Bot size={48} className="mx-auto text-gray-500" />
                    <h3 className="text-xl font-semibold text-white mt-4">No Bots Found</h3>
                    <p className="text-gray-400 mt-2">Let's create your first assistant.</p>
                </div>
            ) : (
                <div className="flex flex-wrap justify-start gap-6">
                    {bots.map(bot => (
                        <div key={bot.id} className="relative bg-gray-900 rounded-2xl shadow-xl p-6 text-white flex flex-col justify-between transform transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:border-blue-500 border border-transparent group min-w-[300px] max-w-lg">
                            {/* Accent border on hover */}
                            <div className="absolute inset-0 rounded-2xl pointer-events-none border border-transparent group-hover:border-blue-600 transition-all duration-300"></div>

                            {/* Bot Icon and Name */}
                            <div className="flex items-center gap-4 mb-5">
                                <div className="bg-gradient-to-br from-indigo-500 to-blue-500 p-3 rounded-full flex items-center justify-center shadow-lg">
                                    <Bot size={32} className="text-white" />
                                </div>
                                <div className="flex-grow">
                                    {editingBotId === bot.id ? (
                                        <input
                                            type="text"
                                            value={editedBotName}
                                            onChange={(e) => setEditedBotName(e.target.value)}
                                            onBlur={() => handleUpdateBotName(bot.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleUpdateBotName(bot.id);
                                                if (e.key === 'Escape') setEditingBotId(null);
                                            }}
                                            className="bg-gray-800 text-white rounded-lg px-3 py-2 text-2xl font-bold w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            autoFocus
                                        />
                                    ) : (
                                        <h2 className="text-2xl font-extrabold text-white truncate capitalize">{bot.name}</h2>
                                    )}
                                </div>
                                <button
                                    onClick={() => { setEditingBotId(bot.id); setEditedBotName(bot.name); }}
                                    className="p-2 text-gray-500 hover:text-blue-400 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                    title="Edit Bot Name"
                                >
                                    <SquarePen size={20} />
                                </button>
                            </div>

                            {/* Actions - Modern and Integrated */}
                            <div className="flex justify-between items-center border-t border-gray-700 pt-4 -mx-6 px-6">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteBot(bot.id); }}
                                    className="flex items-center gap-2 text-gray-400 hover:text-red-500 p-2 rounded-lg transition-colors group/btn"
                                    title="Delete Bot"
                                >
                                    <Trash2 size={18} className="group-hover/btn:scale-110 transition-transform" />
                                    <span className="text-sm">Delete</span>
                                </button>
                                <button
                                    onClick={() => handleCopy(bot.publicApiKey)}
                                    className="flex items-center gap-2 text-gray-400 hover:text-blue-400 p-2 rounded-lg transition-colors group/btn"
                                    title="Copy Embed Code"
                                >
                                    <SquareCode size={18} className="group-hover/btn:scale-110 transition-transform" />
                                    <span className="text-sm">Embed</span>
                                </button>
                                <button
                                    onClick={() => navigate(`/bot/${bot.id}/builder`)}
                                    className="flex items-center gap-2 text-gray-400 hover:text-green-400 p-2 rounded-lg transition-colors group/btn"
                                    title="Open Builder"
                                >
                                    <Settings size={18} className="group-hover/btn:scale-110 transition-transform" />
                                    <span className="text-sm">Builder</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <CreateBotModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreate={handleCreateBot}
            />
        </div>
    );
};