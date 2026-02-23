

import { useAuthStore } from '../store/authStore';

const BASE_URL = '/server/api'; 

// This function now omits 'Content-Type' if the body is FormData
const getHeaders = (body?: any) => {
    const headers: HeadersInit = {};
    
    // ✅ The browser will automatically set the correct multipart header
    // with the boundary string ONLY if we DO NOT set Content-Type ourselves.
    if (!(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const token = useAuthStore.getState().token;
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
    if (!response.ok) {
        const errorText = await response.text();
        try {
            const errorData = JSON.parse(errorText);
            console.error(`API Request failed with status: ${response.status}`, errorData);
            throw new Error(errorData.message || `Request failed with status ${response.status}`);
        } catch (e) {
            console.error(`API Request failed with status: ${response.status}. Response was not valid JSON:`, errorText);
            const match = errorText.match(/"message"\s*:\s*"([^"]*)"/);
            if (match && match[1]) {
                throw new Error(match[1]);
            } else {
                throw new Error(errorText);
            }
        }
    }
    // Handle cases where the response might be empty (e.g., a 204 No Content)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return response.json();
    }
    return Promise.resolve(undefined as T);
};

export const apiClient = {
    async post<T>(endpoint: string, body: unknown): Promise<T> {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: getHeaders(body),
            // ✅ Body is only stringified if it's not FormData
            body: body instanceof FormData ? body : JSON.stringify(body),
        });
        return handleResponse<T>(response);
    },

    async get<T>(endpoint: string): Promise<T> {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'GET',
            headers: getHeaders(),
        });
        return handleResponse<T>(response);
    },
    
    async put<T>(endpoint: string, body: unknown): Promise<T> {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'PUT',
            headers: getHeaders(body),
            body: body instanceof FormData ? body : JSON.stringify(body),
        });
        return handleResponse<T>(response);
    },

    async delete(endpoint: string): Promise<void> {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        await handleResponse<void>(response);
    }
};
