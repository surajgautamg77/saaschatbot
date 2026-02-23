import React, { useState } from 'react';

interface CreateBotModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string) => void;
}

export const CreateBotModal: React.FC<CreateBotModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [name, setName] = useState('My First Bot');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const validateName = (value: string) => {
        const trimmed = value.trim();
        if (trimmed.length === 0) return "Name cannot be empty.";
        if (trimmed.length > 100) return "Name cannot exceed 100 characters.";
        return "";
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setName(value);
        setError(validateName(value));
    };

    const handleSubmit = () => {
        const validation = validateName(name);
        if (validation) {
            setError(validation);
            return;
        }

        onCreate(name.trim());
        setName('');
        setError('');
    };

    const isInvalid = !!validateName(name);

    return (
        <div data-tour="create-bot-model" className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
                <h3 className="text-xl font-semibold mb-4">Create New Bot</h3>

                <input
                    data-tour="bot-name-input"
                    type="text"
                    value={name}
                    onChange={handleChange}
                    placeholder="Enter bot name"
                    className={`w-full px-3 py-2 rounded bg-gray-700 border ${
                        error ? 'border-red-500' : 'border-gray-600'
                    } focus:outline-none focus:border-blue-500`}
                />

                {error && <p className="text-red-400 text-sm mt-2">{error}</p>}

                <div className="flex justify-end gap-4 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-500 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        data-tour="create-bot-submit"
                        onClick={handleSubmit}
                        disabled={isInvalid}
                        className={`px-4 py-2 rounded font-semibold transition-colors ${
                            isInvalid
                                ? 'bg-blue-600/50 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-500'
                        }`}
                    >
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
};
