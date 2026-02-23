import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import { LoadingSpinner, UserIcon } from '../components/Icons';
import { useAuthStore } from '../store/authStore';

import { Pagination } from '../components/Pagination';

// This interface now matches the `Visitor` model from `schema.prisma`
interface Visitor {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
  sessionId: string;
  session: {
    bot: {
      name: string;
    }
  }
}

interface PaginatedVisitorsResponse {
    visitors: Visitor[];
    totalVisitors: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export const VisitorsPage: React.FC = () => {
    const [visitors, setVisitors] = useState<Visitor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const user = useAuthStore((state) => state.user);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const pageSize = 10;

    useEffect(() => {
        const fetchVisitors = async () => {
            setIsLoading(true);
            try {
                // Fetch paginated visitors from the new endpoint
                const data = await apiClient.get<PaginatedVisitorsResponse>(`/visitors?page=${currentPage}&pageSize=${pageSize}`);
                setVisitors(data.visitors);
                setTotalPages(data.totalPages);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load visitors.');
            } finally {
                setIsLoading(false);
            }
        };
        // Allow all authenticated users to see this page for now
        if (user?.role) {
            fetchVisitors();
        }
    }, [user, currentPage]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString(undefined, {
            dateStyle: 'full',
            timeStyle: 'short',
        });
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    if (!user?.role) {
        return (
            <div className="bg-dark-card rounded-xl shadow-lg p-6 text-center">
                <p className="text-red-400">You do not have permission to view this page.</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <LoadingSpinner className="w-12 h-12 text-blue-400" />
            </div>
        );
    }

    if (error) {
        return <p className="text-center text-red-400 bg-red-900/50 p-4 rounded-lg">{error}</p>;
    }

    return (
        <div className="bg-dark-card rounded-xl shadow-lg p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <UserIcon className="w-8 h-8 text-blue-400"/>
                    All Visitors
                </h1>
                {visitors.length !== 0 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={handlePageChange}
                    />
                )}
            </div>
            
            {visitors.length === 0 ? (
                <div className="flex-grow flex items-center justify-center">
                    <p className="text-center text-gray-400 py-8">No visitors found.</p>
                </div>
            ) : (
                <div className="flex-grow flex flex-col">
                    <div className="overflow-x-auto flex-grow mt-4">
                        <table className="min-w-full divide-y divide-gray-700">
                            <thead className="bg-gray-800/50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-blue-400 uppercase tracking-wider">Name</th>
                                    <th scope="col" className="px-6 py-3 text-left text-blue-400 uppercase tracking-wider">Email</th>
                                    <th scope="col" className="px-6 py-3 text-left text-blue-400 uppercase tracking-wider">Phone</th>
                                    <th scope="col" className="px-6 py-3 text-left text-blue-400 uppercase tracking-wider">Visisted At</th>
                                    <th scope="col" className="px-6 py-3 text-left text-blue-400 uppercase tracking-wider">Brand</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {visitors.map((visitor) => (
                                    <tr key={visitor.id} className="hover:bg-gray-800/40">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{visitor.name || 'Anonymous'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{visitor.email || 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{visitor.phone || 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{formatDate(visitor.createdAt)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{visitor.session.bot.name}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
