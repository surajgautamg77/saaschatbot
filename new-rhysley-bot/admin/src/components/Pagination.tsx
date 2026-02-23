import React from 'react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
    const handlePreviousPage = () => {
        if (currentPage > 1) {
            onPageChange(currentPage - 1);
        }
    };

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            onPageChange(currentPage + 1);
        }
    };

    return (
        <div className="flex items-center justify-end text-sm bg-gray-900 p-2 rounded-full ml-4">
            <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm font-medium text-brand-primary bg-gray-800 rounded-full hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                &lt;
            </button>
            <span className="text-sm text-brand-primary mx-4">
                Page {currentPage} of {totalPages}
            </span>
            <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm font-medium text-brand-primary bg-gray-800 rounded-full hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                &gt;
            </button>
        </div>
    );
};
