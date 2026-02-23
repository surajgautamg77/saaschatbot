import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/apiClient';
import { Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { usePermissionStore } from '../store/usePermissionStore'; // Added import

export const ProfilePage: React.FC = () => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [status, setStatus] = useState<{ message: string; isError: boolean } | null>(null);
    
    const { soundEnabled, setSoundEnabled } = usePermissionStore(); // Added this line

    // handleSoundToggle function
    const handleSoundToggle = () => {
        const newState = !soundEnabled;
        setSoundEnabled(newState);
    };

    const inputClass =
        "w-full p-3 bg-gray-800 rounded-lg ring-1 ring-white/10 " +
        "focus:outline-none focus:ring-2 focus:ring-white/40 " +
        "placeholder-gray-400 pr-12";

    // Rule: letters + numbers + symbols + minimum 8 chars
    const strongPasswordRegex =
        /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

    const isStrongPassword = strongPasswordRegex.test(newPassword);
    const passwordsMatch = newPassword === confirmPassword;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // no rule for old password

        // check strength
        if (!isStrongPassword) {
            setStatus({
                message:
                    "Password must be at least 8 characters and include letters, numbers, and symbols. Example: Hero@1234",
                isError: true
            });
            return;
        }

        // check match
        if (!passwordsMatch) {
            setStatus({ message: "New passwords do not match.", isError: true });
            return;
        }

        setStatus(null);

        try {
            const response = await apiClient.post<{ message: string }>('/auth/change-password', {
                oldPassword,
                newPassword,
            });

            setStatus({ message: response.message, isError: false });
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : 'An unknown error occurred.';
            setStatus({ message: errorMessage, isError: true });
        }
    };

    return (
        <div className="space-y-8">
            <div className="bg-gray-900 rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-white mb-4">Change Password</h2>

                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Old Password (no rules) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400">Old Password</label>
                        <div className="relative">
                            <input
                                type={showOld ? 'text' : 'password'}
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                required
                                className={inputClass}
                            />
                            <button
                                type="button"
                                onClick={() => setShowOld(!showOld)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                            >
                                {showOld ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    {/* New Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400">New Password</label>
                        <div className="relative">
                            <input
                                type={showNew ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                className={inputClass}
                            />
                            <button
                                type="button"
                                onClick={() => setShowNew(!showNew)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                            >
                                {showNew ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>

                        {/* Live error */}
                        {newPassword.length > 0 && !isStrongPassword && (
                            <p className="text-red-400 text-sm mt-1">
                                Password must be at least 8 characters and include letters, numbers, and symbols. Example: Hero@1234
                            </p>
                        )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400">Confirm New Password</label>
                        <div className="relative">
                            <input
                                type={showConfirm ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className={inputClass}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirm(!showConfirm)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                            >
                                {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>

                        {/* Live "passwords do not match" message */}
                        {confirmPassword.length > 0 && !passwordsMatch && (
                            <p className="text-red-400 text-sm mt-1">
                                Passwords do not match.
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={!isStrongPassword || !passwordsMatch}
                        className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        Change Password
                    </button>
                </form>

                {status && (
                    <p className={`mt-3 text-sm ${status.isError ? 'text-red-400' : 'text-green-400'}`}>
                        {status.message}
                    </p>
                )}
            </div>

            <div className="bg-gray-900 rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-white mb-4">Notification Settings</h2>
                <div className="flex items-center justify-between">
                    <span className="text-gray-300">Enable Sound Notifications</span>
                    <label htmlFor="sound-toggle" className="flex items-center cursor-pointer">
                        <div className="relative">
                            <input
                                type="checkbox"
                                id="sound-toggle"
                                className="sr-only"
                                checked={soundEnabled}
                                onChange={handleSoundToggle}
                            />
                            <div className="block bg-gray-600 w-14 h-8 rounded-full"></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${soundEnabled ? 'transform translate-x-6 bg-blue-600' : ''}`}></div>
                        </div>
                    </label>
                </div>
            </div>
        </div>
    );
};
