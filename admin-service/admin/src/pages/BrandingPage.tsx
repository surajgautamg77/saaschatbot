

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '../api/apiClient';
import { LoadingSpinner } from '../components/Icons';
import { FormFieldsConfig, type FormField } from '../components/FormFieldsConfig';
import { type Bot } from '../types';

type BotDetails = Omit<Bot, 'id' | 'companyId' | 'nodes' | 'edges'>;

export const BrandingPage: React.FC = () => {
    const { botId } = useParams<{ botId: string }>(); // Get botId from URL
    const [formData, setFormData] = useState<BotDetails | null>(null);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

    const inputClass =
        "w-full p-3 bg-gray-800 rounded-lg ring-1 ring-white/10 " +
        "focus:outline-none focus:ring-2 focus:ring-white/40 " +
        "placeholder-gray-400 pr-12";

    useEffect(() => {
        if (!botId) return;
        const fetchBotDetails = async () => {
            try {
                // CHANGED: Fetch details for the specific bot
                const botDetails = await apiClient.get<BotDetails>(`/bots/${botId}/details`);
                // Ensure formFields is parsed if it's a string
                if (botDetails.formFields && typeof botDetails.formFields === 'string') {
                    botDetails.formFields = JSON.parse(botDetails.formFields);
                }
                setFormData(botDetails);
                setLogoPreview(botDetails.botLogoUrl || null);
            } catch (err) {
                setStatusMessage({ text: 'Failed to load bot details.', isError: true });
            }
        };
        fetchBotDetails();
    }, [botId]);

    useEffect(() => {
        if (statusMessage) {
            const timer = setTimeout(() => {
                setStatusMessage(null);
            }, 3000); // Clear message after 3 seconds
            return () => clearTimeout(timer);
        }
    }, [statusMessage]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (!formData) return;
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!botId || !formData) return;
        setIsSaving(true);
        setStatusMessage(null);
        try {
            const updatedBot = await apiClient.put<BotDetails>(`/bots/${botId}/settings`, formData);
            setFormData(updatedBot);
            setStatusMessage({ text: 'Settings saved successfully!', isError: false });
        } catch (err) {
            setStatusMessage({ text: err instanceof Error ? err.message : "Failed to save settings.", isError: true });
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogoUpload = async () => {
        if (!logoFile || !botId) return;
        setIsUploading(true);
        setStatusMessage(null);
    
        const uploadData = new FormData();
        uploadData.append('logo', logoFile);
    
        try {
            // CHANGED: Upload logo for the specific bot
            const response = await apiClient.post<{ logoUrl: string }>(`/bots/${botId}/logo`, uploadData);
            setFormData(prev => prev ? { ...prev, botLogoUrl: response.logoUrl } : null);
            setLogoFile(null);
            setStatusMessage({ text: 'Logo uploaded successfully!', isError: false });
        } catch (err) {
            setStatusMessage({ text: err instanceof Error ? err.message : "Failed to upload logo.", isError: true });
        } finally {
            setIsUploading(false);
        }
    };

    
    // Previously, we returned <LoadingSpinner /> here if !formData.
    // That prevented the div with data-tour="branding-form" from existing.
    // Now we render the layout immediately.

    return (
        <div className="space-y-8">
            {statusMessage && <div className={`p-4 rounded-md text-center ${statusMessage.isError ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>{statusMessage.text}</div>}
            
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                {/* Settings Form Column */}
                {/* This DIV now exists immediately, so Joyride can find it. */}
                <div className="bg-gray-900 rounded-xl shadow-lg p-6" data-tour="branding-form">
                    <h2 className="text-2xl font-bold text-white mb-4">Bot branding</h2>
                    <p className="mb-6 block text-sm font-medium text-gray-400">Control how your chatbot appears in the widget and inbox.</p>
                    
                    {/* We conditionally render the CONTENTS, not the container */}
                    {!formData ? (
                        <div className="flex justify-center items-center h-64">
                            <LoadingSpinner className="w-12 h-12" />
                        </div>
                    ) : (
                        <form onSubmit={handleSaveSettings} className="space-y-4">
                            <div>
                                <label htmlFor="botName" className="block text-sm font-medium text-gray-400">Chat panel display name</label>
                                <input
                                    type="text"
                                    name="botName"
                                    value={formData.botName || ''}
                                    onChange={handleInputChange}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label htmlFor="companyName" className="block text-sm font-medium text-gray-400">Company name</label>
                                <input
                                    type="text"
                                    name="companyName"
                                    value={formData.companyName || ''}
                                    onChange={handleInputChange}
                                    className={inputClass}
                                />
                                <p className="mt-1 text-xs text-slate-400">
                                    Use this to label which company or tenant this chatbot belongs to (for your internal reference).
                                </p>
                            </div>
                            <div>
                                <label htmlFor="companyDescription" className="block text-sm font-medium text-gray-400">Company description</label>
                                <textarea
                                    name="companyDescription"
                                    value={formData.companyDescription || ''}
                                    onChange={handleInputChange}
                                    rows={3}
                                    className={inputClass}
                                ></textarea>
                                <p className="mt-1 text-xs text-slate-400">
                                    Short description of this company/tenant (e.g. website, product line, or use case) to help you manage multiple chatbots.
                                </p>
                            </div>
                            <div>
                                <label htmlFor="welcomeMessage" className="block text-sm font-medium text-gray-400">Welcome message</label>
                                <textarea
                                    name="welcomeMessage"
                                    value={formData.welcomeMessage || ''}
                                    onChange={handleInputChange}
                                    rows={3}
                                    className={inputClass}
                                ></textarea>
                            </div>
                            <div>
                                <label htmlFor="widgetColor" className="block text-sm font-medium text-gray-400">Widget color</label>
                                <div className="mt-1 flex items-center gap-4">
                                    <input
                                        type="color"
                                        name="widgetColor"
                                        value={formData.widgetColor || '#07a74d'}
                                        onChange={handleInputChange}
                                        className="h-10 w-10 rounded-md border border-slate-700 bg-slate-900 p-1"
                                    />
                                    <input
                                        type="text"
                                        name="widgetColor"
                                        value={formData.widgetColor || '#07a74d'}
                                        onChange={handleInputChange}
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="popupDelay" className="block text-sm font-medium text-gray-400">Popup delay (seconds)</label>
                                <input
                                    type="number"
                                    name="popupDelay"
                                    min="0"
                                    value={formData.popupDelay || 0}
                                    onChange={handleInputChange}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label htmlFor="historyExpiryHours" className="block text-sm font-medium text-gray-400">Chat history expiry (hours)</label>
                                <input
                                    type="number"
                                    name="historyExpiryHours"
                                    min="0"
                                    value={formData.historyExpiryHours || 24}
                                    onChange={handleInputChange}
                                    className={inputClass}
                                />
                                <p className="mt-1 text-xs text-slate-400">Clear chat history after this many hours of inactivity. Set to 0 to never expire.</p>
                            </div>
                            <div>
                                <label htmlFor="chatInactivityTimeout" className="block text-sm font-medium text-gray-400">Chat Inactivity Timeout (seconds)</label>
                                <input
                                    type="number"
                                    name="chatInactivityTimeout"
                                    min="0"
                                    value={formData.chatInactivityTimeout || 0}
                                    onChange={handleInputChange}
                                    className={inputClass}
                                />
                                <p className="mt-1 text-xs text-slate-400">Automatically close chat after this many seconds of inactivity. Set to 0 for no timeout.</p>
                            </div>
                            <div>
                                <label htmlFor="showUserForm" className="flex items-center justify-between cursor-pointer">
                                    <span className="text-gray-200">Show User Information Form</span>
                                    <div className="relative">
                                        <input 
                                            type="checkbox" 
                                            id="showUserForm" 
                                            name="showUserForm" 
                                            checked={formData.showUserForm !== false} 
                                            onChange={(e) => setFormData({ ...formData, showUserForm: e.target.checked })} 
                                            className="sr-only peer" 
                                        />
                                        <div className="w-14 h-8 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-brand-primary"></div>
                                    </div>
                                </label>
                                <p className="mt-1 text-xs text-slate-400">When enabled, visitors will be asked to provide their name and email before starting a chat.</p>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {isSaving ? 'Saving...' : 'Save Settings'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Logo Upload Column */}
                <div className="bg-gray-900 rounded-xl shadow-lg p-6">
                    <h2 className="text-2xl font-bold text-white mb-4">Bot logo</h2>
                    <p className="mb-6 block text-sm font-medium text-gray-400">Upload the avatar that appears in your chat widget.</p>
                    {!formData ? (
                        <div className="flex justify-center items-center h-64">
                            <LoadingSpinner className="w-12 h-12" />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            <div className="mb-4 flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-800">
                                {logoPreview ? <img src={logoPreview.startsWith('blob:') ? logoPreview : logoPreview} alt="Logo Preview" className="w-full h-full object-cover" /> : <span>Preview</span>}
                            </div>
                            <input type="file" id="logo-upload" className="hidden" onChange={handleLogoChange} accept="image/*" />
                            <label
                                htmlFor="logo-upload"
                                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                Choose File...
                            </label>
                            <div className="mt-6 w-full">
                                <button
                                    onClick={handleLogoUpload}
                                    disabled={!logoFile || isUploading}
                                    className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 w-full"
                                >
                                    {isUploading ? 'Uploading...' : 'Upload Logo'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Form Fields Configuration Section */}
            {formData && formData.showUserForm !== false && (
                <FormFieldsConfig
                    fields={formData.formFields || []}
                    onChange={(fields) => setFormData({ ...formData, formFields: fields })}
                />
            )}
        </div>
    );
};