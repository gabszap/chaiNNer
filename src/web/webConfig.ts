declare const CHAINNER_BACKEND_URL: string | undefined;

const BACKEND_URL_STORAGE_KEY = 'chainner-web-backend-url';

const normalizeBackendUrl = (url: string): string => url.trim().replace(/\/+$/, '');

export const getWebBackendUrl = (): string => {
    const stored = localStorage.getItem(BACKEND_URL_STORAGE_KEY);
    if (stored && stored.trim()) {
        return normalizeBackendUrl(stored);
    }
    if (typeof CHAINNER_BACKEND_URL === 'string' && CHAINNER_BACKEND_URL.trim()) {
        return normalizeBackendUrl(CHAINNER_BACKEND_URL);
    }
    return '/api';
};

export const setWebBackendUrl = (url: string): void => {
    const normalized = normalizeBackendUrl(url);
    if (!normalized) {
        localStorage.removeItem(BACKEND_URL_STORAGE_KEY);
    } else {
        localStorage.setItem(BACKEND_URL_STORAGE_KEY, normalized);
    }
};
