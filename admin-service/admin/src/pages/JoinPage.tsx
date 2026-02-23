

import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/apiClient';
import { useAuthStore } from '../store/authStore';
import { User, Company } from '../types';
import { Eye, EyeOff } from 'lucide-react';

export const JoinPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const loginAction = useAuthStore((state) => state.login);

    const [token, setToken] = useState<string | null>(null);

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Strong password check
    const isStrongPassword = (pwd: string) => {
        return /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(pwd);
    };

    // Real-time validation
    useEffect(() => {
        if (password && !isStrongPassword(password)) {
            setError(
                "Password must be at least 8 characters and include letters, numbers, and symbols. Example: Hero@1234"
            );
        } else if (confirmPassword && password !== confirmPassword) {
            setError("Passwords do not match.");
        } else {
            setError(null);
        }
    }, [password, confirmPassword]);

    useEffect(() => {
        const urlToken = searchParams.get('token');
        if (!urlToken) {
            setError('Invitation token not found. Please use the link from your invitation email.');
        } else {
            setToken(urlToken);
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Final validation
        if (!isStrongPassword(password)) {
            setError(
                "Password must be at least 8 characters and include letters, numbers, and symbols. Example: Hero@1234"
            );
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (!token) {
            setError('Invitation token is missing.');
            return;
        }

        setError(null);
        setIsLoading(true);

        try {
            const response = await apiClient.post<{ token: string; user: User }>('/auth/accept-invitation', {
                token,
                password,
            });

            useAuthStore.getState().login(response.user, response.token, {} as Company);
            const companyResponse = await apiClient.get<Company>('/company');
            loginAction(response.user, response.token, companyResponse);

            navigate('/');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-dark-bg">
            <div className="w-full max-w-md p-8 space-y-8 bg-dark-card rounded-xl shadow-lg">
                <div>
                    <h1 className="text-3xl font-extrabold text-center text-white">
                        <span className="text-brand-primary">Join Your Team</span>
                    </h1>
                    <p className="mt-2 text-center text-sm text-gray-400">
                        Set your password to accept the invitation.
                    </p>
                </div>

                {token ? (
                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>

                        {/* PASSWORD */}
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="Create a Password"
                                className="
                                    w-full p-3 bg-gray-800 rounded-md
                                    text-gray-200 placeholder-gray-500
                                    ring-1 ring-white/10
                                    focus:outline-none
                                    focus:ring-2 focus:ring-white/40
                                    pr-12
                                "
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>

                        {/* CONFIRM PASSWORD */}
                        <div className="relative">
                            <input
                                type={showConfirm ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                placeholder="Confirm Password"
                                className="
                                    w-full p-3 bg-gray-800 rounded-md
                                    text-gray-200 placeholder-gray-500
                                    ring-1 ring-white/10
                                    focus:outline-none
                                    focus:ring-2 focus:ring-white/40
                                    pr-12
                                "
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirm(!showConfirm)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                            >
                                {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>

                        {/* LIVE ERROR */}
                        {error && (
                            <p className="mt-2 text-sm text-red-400 text-center">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="
                                w-full flex justify-center py-3 px-4
                                text-sm font-medium rounded-md
                                text-black bg-brand-primary hover:bg-yellow-300
                                focus:outline-none focus:ring-1 focus:ring-white/20
                                disabled:opacity-50
                            "
                        >
                            {isLoading ? 'Joining...' : 'Join Team'}
                        </button>
                    </form>
                ) : (
                    <p className="mt-2 text-lg text-red-400 text-center">{error || 'Loading invitation...'}</p>
                )}
            </div>
        </div>
    );
};
