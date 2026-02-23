

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '../api/apiClient';
import { BotIcon, Copy } from 'lucide-react';

interface BotSummary {
    id: string;
    name: string;
    publicApiKey: string;
}

export const EmbedPage: React.FC = () => {
    const { botId } = useParams<{ botId: string }>();
    const [bots, setBots] = useState<BotSummary[]>([]);
    const [selectedBot, setSelectedBot] = useState<BotSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchBotDetails = useCallback(async (id: string) => {
        setIsLoading(true);
        try {
            const botData = await apiClient.get<BotSummary>(`/bots/${id}/details`);
            setSelectedBot(botData);
        } catch (error) {
            console.error(`Failed to fetch bot details for botId ${id}`, error);
            setSelectedBot(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchAllBots = useCallback(async () => {
        setIsLoading(true);
        try {
            const botsData = await apiClient.get<BotSummary[]>('/bots');
            const sortedBots = botsData.sort((a, b) => b.id.localeCompare(a.id));
            setBots(sortedBots);
        } catch (error) {
            console.error("Failed to fetch all bots for embed codes", error);
            setBots([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (botId) {
            fetchBotDetails(botId);
        } else {
            fetchAllBots();
        }
    }, [botId, fetchBotDetails, fetchAllBots]);

    const widgetSrc = `${window.location.origin}/client/widget.js`;

    const handleCopy = (apiKey: string) => {
        const embedCode = `<script type="module" src="${widgetSrc}" data-company-key="${apiKey}"></script>`;
        navigator.clipboard.writeText(embedCode);
        alert('Copied to clipboard!');
    };

    return (
        <div className="bg-gray-900 rounded-xl shadow-lg p-6 sm:p-8">
            <p className="text-gray-400 mb-8 max-w-2xl">
                {botId
                    ? `Copy the snippet below to embed ${selectedBot?.name || 'this bot'} on your website.`
                    : `Each bot has a unique installation code. Copy the snippet for the bot you wish to embed and paste it just before the closing </body> tag on your website.`
                }
            </p>

            <div className="space-y-6">
                {botId ? (
                    isLoading ? (
                        <div className={`bg-gray-800/50 p-4 rounded-lg border border-gray-700 animate-pulse`}>
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 bg-gray-700 rounded-full"></div>
                                    <div className="h-6 w-32 bg-gray-700 rounded"></div>
                                </div>
                                <div className="h-10 w-24 bg-gray-700 rounded"></div>
                            </div>
                            <div className="bg-gray-900 p-3 rounded-md h-16 w-full"></div>
                        </div>
                    ) : selectedBot ? (
                        <div data-tour="bot-installation" className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-3">
                                <div className="flex items-center gap-3">
                                    <BotIcon className="w-6 h-6 text-blue-400 flex-shrink-0" />
                                    <h3 className="text-lg font-semibold text-white">{selectedBot.name}</h3>
                                </div>
                                <button
                                    onClick={() => handleCopy(selectedBot.publicApiKey)}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto">
                                    <Copy size={16} />
                                    Copy Code
                                </button>
                            </div>
                            <div className="relative w-full" data-tour="embed-code-area">
                                <pre className="bg-gray-900 p-3 rounded-md text-gray-300 overflow-x-auto text-sm">
                                    <code>{`<script type="module" src="${widgetSrc}" data-company-key="${selectedBot.publicApiKey}"></script>`}</code>
                                </pre>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-10 border-2 border-dashed border-gray-700 rounded-lg">
                            <h3 className="text-lg font-semibold text-white">Bot Not Found</h3>
                            <p className="text-gray-500 mt-1">The requested bot could not be loaded.</p>
                        </div>
                    )
                ) : (
                    <>
                        {/* STABLE FIRST ITEM WRAPPER */}
                        {/* We render the first item (or its skeleton) separately to ensure the data-tour target 
                            persists in the DOM during the transition from Loading -> Loaded. 
                            This prevents Joyride from losing the target or defaulting to top-left. */}
                        {(isLoading || bots.length > 0) && (
                            <div className={`bg-gray-800/50 p-4 rounded-lg border border-gray-700 ${isLoading ? 'animate-pulse' : ''}`}>

                                {/* HEADER SECTION */}
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-3">
                                    {isLoading ? (
                                        <>
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 bg-gray-700 rounded-full"></div>
                                                <div className="h-6 w-32 bg-gray-700 rounded"></div>
                                            </div>
                                            <div className="h-10 w-24 bg-gray-700 rounded"></div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-3">
                                                <BotIcon className="w-6 h-6 text-blue-400 flex-shrink-0" />
                                                <h3 className="text-lg font-semibold text-white">{bots[0].name}</h3>
                                                <span className="text-xs bg-blue-900 text-blue-200 px-2 py-0.5 rounded">Newest</span>
                                            </div>
                                            <button
                                                onClick={() => handleCopy(bots[0].publicApiKey)}
                                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto">
                                                <Copy size={16} />
                                                Copy Code
                                            </button>
                                        </>
                                    )}
                                </div>

                                {/* CODE AREA - STABLE TARGET */}
                                {/* This div exists in both Loading and Loaded states, preserving the Joyride anchor. */}
                                <div
                                    className="relative w-full"
                                    data-tour="embed-code-area"
                                >
                                    {isLoading ? (
                                        <div className="bg-gray-900 p-3 rounded-md h-16 w-full"></div>
                                    ) : (
                                        <pre className="bg-gray-900 p-3 rounded-md text-gray-300 overflow-x-auto text-sm">
                                            <code>{`<script type="module" src="${widgetSrc}" data-company-key="${bots[0].publicApiKey}"></script>`}</code>
                                        </pre>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* REMAINING BOTS (Index 1+) */}
                        {!isLoading && bots.slice(1).map((bot) => (
                            <div key={bot.id} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-3">
                                    <div className="flex items-center gap-3">
                                        <BotIcon className="w-6 h-6 text-blue-400 flex-shrink-0" />
                                        <h3 className="text-lg font-semibold text-white">{bot.name}</h3>
                                    </div>
                                    <button
                                        onClick={() => handleCopy(bot.publicApiKey)}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto">
                                        <Copy size={16} />
                                        Copy Code
                                    </button>
                                </div>

                                <div className="relative w-full">
                                    <pre className="bg-gray-900 p-3 rounded-md text-gray-300 overflow-x-auto text-sm">
                                        <code>{`<script type="module" src="${widgetSrc}" data-company-key="${bot.publicApiKey}"></script>`}</code>
                                    </pre>
                                </div>
                            </div>
                        ))}

                        {/* EMPTY STATE */}
                        {!isLoading && bots.length === 0 && (
                            <div className="text-center py-10 border-2 border-dashed border-gray-700 rounded-lg">
                                <h3 className="text-lg font-semibold text-white">No Bots Found</h3>
                                <p className="text-gray-500 mt-1">Create a bot in the "Bots" section to get its installation code.</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};