import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/apiClient';
import { User, Company } from '../types';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

export const LoginPage: React.FC = () => {
    const { isAuthenticated, login: loginAction } = useAuthStore();
    const navigate = useNavigate();

    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [companyName, setCompanyName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [emailError, setEmailError] = useState<string | null>(null);

    // strong password rule
    const isStrongPassword = (pwd: string) => {
        return /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(pwd);
    };

    // REAL-TIME PASSWORD VALIDATION (only for signup)
    useEffect(() => {
        if (!isLogin) {
            if (password && !isStrongPassword(password)) {
                setError(
                    "Password must be at least 8 characters and include letters, numbers, and symbols. Example: Hero@1234"
                );
            } else {
                setError(null);
            }
        }
    }, [password, isLogin]);

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    // CLEAR FORM WHEN TOGGLING LOGIN ↔ SIGNUP
    useEffect(() => {
        setError(null);
        setEmailError(null);
        setEmail('');
        setPassword('');
        setCompanyName('');
    }, [isLogin]);

    const validateEmail = (value: string) => {
        const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (value && !pattern.test(value)) {
            setEmailError('Please enter a valid email address.');
        } else {
            setEmailError(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (emailError) {
            setError('Please fix the highlighted errors before submitting.');
            return;
        }

        // FINAL STRONG PASSWORD VALIDATION FOR SIGNUP
        if (!isLogin && !isStrongPassword(password)) {
            setError(
                "Password must be at least 8 characters and include letters, numbers, and symbols. Example: Hero@1234"
            );
            return;
        }

        setError(null);
        setIsLoading(true);

        try {
            let authResponse;

            if (isLogin) {
                authResponse = await apiClient.post<{ token: string; user: User }>('/auth/login', {
                    email, password
                });
            } else {
                authResponse = await apiClient.post<{ token: string; user: User }>('/auth/signup', {
                    email, password, companyName
                });
            }

            useAuthStore.getState().login(authResponse.user, authResponse.token, {} as Company);
            const companyResponse = await apiClient.get<Company>('/company');

            if (isMounted.current) {
                loginAction(authResponse.user, authResponse.token, companyResponse);
            }

        } catch (err) {
            if (isMounted.current) {
                setError(err instanceof Error ? err.message : 'An unknown error occurred.');
                setIsLoading(false);
            }
            useAuthStore.getState().clearAuth();
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-dark-bg">
            <div className="w-full max-w-md p-8 space-y-8 bg-dark-card rounded-xl shadow-lg">
                <div>
                    <h1 className="text-3xl font-extrabold text-center text-white">
                        <span className="text-brand-primary">
                            {isLogin ? 'Admin Login' : 'Create Account'}
                        </span>
                    </h1>
                    <p className="mt-2 text-center text-sm text-gray-400">
                        {isLogin ? 'Sign in to manage your chatbot' : 'Create an account to get started'}
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    
                    {!isLogin && (
                        <input
                            id="company-name"
                            name="companyName"
                            type="text"
                            required
                            className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-700 bg-gray-800 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-white/2 sm:text-sm"
                            placeholder="Company Name"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                        />
                    )}

                    <div>
                        <input
                            id="email-address"
                            name="email"
                            type="email"
                            required
                            className={`appearance-none rounded-md relative block w-full px-3 py-3 border ${emailError ? 'border-red-500' : 'border-gray-700'} bg-gray-800 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-white/2 sm:text-sm`}
                            placeholder="Email address"
                            value={email}
                            onFocus={() => setError(null)}
                            onChange={(e) => { setEmail(e.target.value); validateEmail(e.target.value); }}
                        />
                        {emailError && <p className="mt-1 text-xs text-red-400">{emailError}</p>}
                    </div>

                    <div className="relative">
                        <input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            required
                            className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-700 bg-gray-800 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-white/2 sm:text-sm"
                            placeholder="Password"
                            value={password}
                            onFocus={() => setError(null)}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>

                    {error && (
                        <p className="mt-2 text-sm text-red-400 text-center">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || !!emailError}
                        className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-black bg-brand-primary hover:bg-yellow-300 focus:outline-none focus:ring-1 focus:ring-offset-2 focus:ring-offset-dark-card focus:ring-white/2 disabled:opacity-50"
                    >
                        {isLoading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
                    </button>
                </form>

                <p className="text-center text-sm">
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="font-medium text-brand-primary hover:text-yellow-300"
                    >
                        {isLogin ? 'Need an account? Sign Up' : 'Already have an account? Sign In'}
                    </button>
                </p>
            </div>
        </div>
    );
};
