

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { FileIcon, UploadIcon, LoadingSpinner } from '../components/Icons';
import { apiClient } from '../api/apiClient';

interface KnowledgeSource {
    id: string;
    fileName: string;
    createdAt: string;
}

const Uploader: React.FC<{ botId: string; onUploadSuccess: () => void }> = ({ botId, onUploadSuccess }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const filesArray = Array.from(e.target.files);
            setFiles(prevFiles => [...prevFiles, ...filesArray]);
        }
    };

    const handleRemoveFile = (index: number) => {
        setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setFiles(prevFiles => [...prevFiles, ...Array.from(e.dataTransfer.files)]);
            e.dataTransfer.clearData();
        }
    };

    const handleUpload = async () => {
        if (files.length === 0) return;
        setIsUploading(true);
        setError(null);
        
        const formData = new FormData();
        files.forEach(file => formData.append('files', file));

        try {
            // the correct, bot-specific API endpoint
            await apiClient.post(`/bots/${botId}/knowledge/upload`, formData);
            onUploadSuccess();
            setFiles([]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="bg-gray-900 rounded-xl shadow-lg p-6 mb-8" data-tour="knowledge-uploader">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Add Knowledge Source</h2>
                <a href="/admin/sample.xlsx" download="sample.xlsx" className="px-4 py-2 bg-gray-600 text-white text-sm font-semibold rounded-lg hover:bg-gray-700">
                    Download Sample File
                </a>
            </div>
            <div
                className={`border-2 border-dashed border-gray-600 rounded-lg p-8 text-center ${isDragging ? 'bg-gray-700' : ''}`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <input type="file" id="knowledge-upload" onChange={handleFileChange} className="hidden" multiple accept=".txt,.json,.pdf,.md,.docx,.xlsx" />
                <label htmlFor="knowledge-upload" className="cursor-pointer flex flex-col items-center">
                    <UploadIcon className="w-12 h-12 text-gray-400 mb-2" />
                    <span>Choose files or drag & drop</span>
                    <p className="text-sm text-gray-400 mt-2">Supported file types: .pdf, .docx, .xlsx. Max file size: 10MB.</p>
                </label>
            </div>
            {files.length > 0 && (
                <div className="mt-4">
                    <h3 className="text-lg font-semibold text-white">Selected Files:</h3>
                    <ul className="mt-2 space-y-2">
                        {files.map((file, index) => (
                            <li key={index} className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg">
                                <span className="text-white">{file.name}</span>
                                <button onClick={() => handleRemoveFile(index)} className="text-red-500 hover:text-red-700">
                                    Remove
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <div className="mt-4 text-center">
                <button 
                    onClick={handleUpload} 
                    // [+++ ADDED DATA ATTRIBUTE HERE +++]
                    data-tour="upload-button"
                    disabled={files.length === 0 || isUploading} 
                    className="px-8 py-2 bg-brand-primary text-black font-semibold rounded-lg disabled:opacity-50"
                >
                    {isUploading ? 'Uploading...' : `Upload ${files.length} File(s)`}
                </button>
            </div>
            {error && <p className="mt-3 text-sm text-red-400 text-center">{error}</p>}
        </div>
    );
};

export const KnowledgePage: React.FC = () => {
    const { botId } = useParams<{ botId: string }>();
    const [sources, setSources] = useState<KnowledgeSource[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSources = useCallback(async () => {
        if (!botId) return;
        try {
            setIsLoading(true);
            setError(null);
            // CHANGED: Fetch knowledge for the specific bot
            const data = await apiClient.get<KnowledgeSource[]>(`/bots/${botId}/knowledge`);
            setSources(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch sources.');
        } finally {
            setIsLoading(false);
        }
    }, [botId]);

    useEffect(() => {
        fetchSources();
    }, [fetchSources]);

    const handleDelete = async (sourceId: string) => {
        if (!window.confirm('Are you sure you want to delete this file?')) return;
        try {
            // The delete endpoint is generic, which is fine
            await apiClient.delete(`/knowledge/${sourceId}`);
            fetchSources();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete file.');
        }
    };

    if (!botId) return <p>Bot not selected.</p>;

    return (
        <div>
            <Uploader botId={botId} onUploadSuccess={fetchSources} />

            <div className="bg-gray-900 rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-white mb-4">Knowledge Sources ({sources.length})</h2>
                {isLoading && <LoadingSpinner />}
                {error && <p className="text-red-400">{error}</p>}
                {!isLoading && sources.length === 0 && <p className="text-gray-400">No knowledge sources uploaded for this bot yet.</p>}
                <div className="space-y-3">
                    {sources.map(source => (
                        <div key={source.id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <FileIcon className="w-6 h-6 text-brand-primary" />
                                <div>
                                    <p className="font-semibold">{source.fileName}</p>
                                    <p className="text-sm text-gray-400">Uploaded on {new Date(source.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <button onClick={() => handleDelete(source.id)} className="px-4 py-1 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700">
                                Delete
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};