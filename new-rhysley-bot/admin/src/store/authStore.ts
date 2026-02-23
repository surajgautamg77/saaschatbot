import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User, Company } from '../types';
import { apiClient } from '../api/apiClient';

// This interface defines the complete shape of our authentication state.
// It includes the data we store (user, token, company) and the actions
// we can perform on that data (login, logout).
interface AuthState {
    user: User | null;
    token: string | null;
    company: Company | null;
    isAuthenticated: boolean;
    login: (userData: User, token: string, companyData: Company) => void;
    logout: () => void;
    clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
    // The `persist` middleware automatically saves the store's state.
    persist(
        // The `set` function is how we update the state.
        (set) => ({
            // --- Initial State ---
            user: null,
            token: null,
            company: null,
            isAuthenticated: false,

            // --- Actions ---
            
            // The login action takes all necessary data and updates the state
            // to reflect an authenticated user.
            login: (userData, token, companyData) => {
                set({ 
                    user: userData, 
                    token, 
                    company: companyData, 
                    isAuthenticated: true 
                });
            },

            // The logout action resets all state properties to their initial
            // null/false values.
            logout: async () => {
                try {
                    await apiClient.post('/auth/logout', {});
                } catch (error) {
                    console.error('Failed to logout on server', error);
                }
                set({ 
                    user: null, 
                    token: null, 
                    company: null, 
                    isAuthenticated: false 
                });
                window.location.href = '/admin/login';
            },

            clearAuth: () => {
                set({ 
                    user: null, 
                    token: null, 
                    company: null, 
                    isAuthenticated: false 
                });
            },
        }),
        {
            // --- Middleware Configuration ---
            name: 'auth-storage', // The key used in sessionStorage.
            // We explicitly use sessionStorage to log the user out when the browser closes.
            storage: createJSONStorage(() => sessionStorage), 
        }
    )
);