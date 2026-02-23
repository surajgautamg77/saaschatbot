import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import { BotIcon, UserIcon, MessageSquareIcon, LoadingSpinner } from '../components/Icons';
import DonutChart from '../components/DonutChart';

interface AnalyticsSummary {
    totalConversations: number;
    botHandledCount: number;
    adminHandledCount: number;
}

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ElementType; gradientClass: string; iconColorClass?: string }> = ({ title, value, icon: Icon, gradientClass, iconColorClass = 'text-white' }) => (
    <div className={`relative rounded-xl shadow-lg p-6 text-white ${gradientClass} transition-transform transform`}>
        <div className="relative z-10">
            <p className="text-lg font-medium opacity-90">{title}</p>
            <p className="text-5xl font-extrabold mt-2">{value}</p>
        </div>
        <Icon className={`absolute bottom-4 right-4 w-20 h-20 ${iconColorClass} opacity-20`} />
    </div>
);

export const AnalyticsPage: React.FC = () => {
    const [data, setData] = useState<AnalyticsSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const summaryData = await apiClient.get<AnalyticsSummary>('/analytics/summary');
                setData(summaryData);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load analytics data.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchAnalytics();
    }, []);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <LoadingSpinner className="w-12 h-12 text-brand-primary" />
            </div>
        );
    }

    if (error) {
        return <p className="text-center text-red-400">{error}</p>;
    }

    if (!data) {
        return <p className="text-center text-gray-400">No analytics data available.</p>;
    }

    const totalAnswered = data.botHandledCount + data.adminHandledCount;
    const botPercentage = totalAnswered > 0 ? (data.botHandledCount / totalAnswered) * 100 : 0;
    const agentPercentage = totalAnswered > 0 ? (data.adminHandledCount / totalAnswered) * 100 : 0;

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-white"></h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard title="Total User Queries" value={data.totalConversations} icon={MessageSquareIcon} gradientClass="bg-gradient-to-br from-purple-900 to-purple-950" />
                <StatCard title="Resolved by Bot" value={data.botHandledCount} icon={BotIcon} gradientClass="bg-gradient-to-br from-green-900 to-green-950" />
                <StatCard title="Handled by Agents" value={data.adminHandledCount} icon={UserIcon} gradientClass="bg-gradient-to-br from-blue-900 to-blue-950" />
            </div>
            
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4"></h2>
                <div className="flex flex-col md:flex-row items-center md:space-x-8">
                    <div className="flex-1 flex justify-center">
                        <DonutChart botPercentage={botPercentage} agentPercentage={agentPercentage} totalAnswered={totalAnswered} />
                    </div>
                    <div className="flex-1 mt-6 p-6 md:mt-0 flex flex-col justify-between h-96">
                        <div>
                            <h3 className="text-lg font-bold text-white mb-3">Actual Values</h3>
                            <ul className="space-y-3 text-sm">
                                <li className="flex justify-between items-center">
                                    <div className="flex items-center">
                                        <span className="w-3 h-3 rounded-full bg-green-500 mr-3"></span>
                                        <span>Resolved by Bot</span>
                                    </div>
                                    <span className="font-bold text-white">{data.botHandledCount}</span>
                                </li>
                                <li className="flex justify-between items-center">
                                    <div className="flex items-center">
                                        <span className="w-3 h-3 rounded-full bg-blue-500 mr-3"></span>
                                        <span>Handled by Agents</span>
                                    </div>
                                    <span className="font-bold text-white">{data.adminHandledCount}</span>
                                </li>
                                <li className="border-t border-white/10 pt-3 mt-3 flex justify-between items-center">
                                    <span className="font-medium text-gray-400">Total Answered</span>
                                    <span className="font-bold text-white">{totalAnswered}</span>
                                </li>

                            </ul>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white mb-3">Percentage</h3>
                            <ul className="space-y-3 text-sm">
                                <li className="flex justify-between items-center">
                                    <div className="flex items-center">
                                        <span className="w-3 h-3 rounded-full bg-green-500 mr-3"></span>
                                        <span>Resolved by Bot</span>
                                    </div>
                                    <span className="font-bold text-white">{botPercentage.toFixed(1)}%</span>
                                </li>
                                <li className="flex justify-between items-center">
                                    <div className="flex items-center">
                                        <span className="w-3 h-3 rounded-full bg-blue-500 mr-3"></span>
                                        <span>Handled by Agents</span>
                                    </div>
                                    <span className="font-bold text-white">{agentPercentage.toFixed(1)}%</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};