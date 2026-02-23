import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import { LoadingSpinner, CalendarIcon } from '../components/Icons';
import { Pagination } from '../components/Pagination';

// Update the BookingDetails type to include the nested bot object
interface BookingDetailsWithBot {
  id?: string;
  date: Date | string;
  name: string;
  email: string;
  phone: string;
  details: string;
  bot: {
    name: string;
  };
}

interface PaginatedBookingsResponse {
    bookings: BookingDetailsWithBot[];
    totalBookings: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export const BookingsPage: React.FC = () => {
    const [bookings, setBookings] = useState<BookingDetailsWithBot[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const pageSize = 10;

    useEffect(() => {
        const fetchBookings = async () => {
            setIsLoading(true);
            try {
                // The API call is the same, but the expected type is now updated
                const data = await apiClient.get<PaginatedBookingsResponse>(`/bookings?page=${currentPage}&pageSize=${pageSize}`);
                setBookings(data.bookings);
                setTotalPages(data.totalPages);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load bookings.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchBookings();
    }, [currentPage]);

    const formatDate = (dateString: Date | string) => {
        return new Date(dateString).toLocaleString(undefined, {
            dateStyle: 'full',
            timeStyle: 'short',
        });
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

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
                    <CalendarIcon className="w-8 h-8 text-blue-400"/>
                    Contacts & Bookings
                </h1>
                {bookings.length !== 0 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={handlePageChange}
                    />
                )}
            </div>
            
            {bookings.length === 0 ? (
                <div className="flex-grow flex items-center justify-center">
                    <p className="text-center text-gray-400 py-8">No bookings have been made yet.</p>
                </div>
            ) : (
                <div className="flex-grow flex flex-col">
                    <div className="overflow-x-auto flex-grow mt-4">
                        <table className="min-w-full divide-y divide-gray-700">
                            <thead className="bg-gray-800/50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-blue-400 uppercase tracking-wider">Date & Time</th>
                                    <th scope="col" className="px-6 py-3 text-left text-blue-400 uppercase tracking-wider">Name</th>
                                    <th scope="col" className="px-6 py-3 text-left text-blue-400 uppercase tracking-wider">Contact</th>
                                    <th scope="col" className="px-6 py-3 text-left text-blue-400 uppercase tracking-wider">Details</th>
                                  
                                    <th scope="col" className="px-6 py-3 text-left text-blue-400 uppercase tracking-wider">Brand</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {bookings.map((booking) => (
                                    <tr key={booking.id} className="hover:bg-gray-800/40">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{formatDate(booking.date)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{booking.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                            <div>{booking.email}</div>
                                            <div>{booking.phone}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 max-w-xs truncate">{booking.details}</td>
                                        
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                            <div className="flex items-center gap-2">
                                                <span>{booking.bot.name}</span>
                                            </div>
                                        </td>
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