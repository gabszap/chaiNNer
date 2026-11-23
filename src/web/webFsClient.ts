import { getWebBackendUrl } from './webConfig';

export interface WebFileEntry {
    name: string;
    path: string;
    relativePath: string;
    isDir: boolean;
    size: number;
    fileCount: number;
    modifiedMs: number;
    ext: string;
    isImage: boolean;
}

export interface WebBreadcrumb {
    name: string;
    path: string;
}

export interface WebShortcutEntry {
    id: string;
    name: string;
    path: string;
    size: number;
    fileCount: number;
}

export interface WebDirectoryListing {
    root: string;
    currentPath: string;
    relativePath: string;
    parentPath: string | null;
    breadcrumbs: WebBreadcrumb[];
    shortcuts: WebShortcutEntry[];
    entries: WebFileEntry[];
}

interface ApiErrorPayload {
    error?: string;
}

const parseError = async (resp: Response): Promise<string> => {
    try {
        const data = (await resp.json()) as ApiErrorPayload;
        if (data.error) return data.error;
    } catch {
        // Fallback to HTTP status text
    }
    return `HTTP ${resp.status} ${resp.statusText}`;
};

export const listWebDirectory = async (
    targetPath?: string,
    extensions?: readonly string[]
): Promise<WebDirectoryListing> => {
    const params = new URLSearchParams();
    if (targetPath) {
        params.set('path', targetPath);
    }
    if (extensions && extensions.length > 0) {
        params.set('extensions', extensions.join(','));
    }

    const query = params.toString();
    const url = `${getWebBackendUrl()}/web/fs/list${query ? `?${query}` : ''}`;
    const resp = await fetch(url, { credentials: 'same-origin' });
    if (!resp.ok) {
        throw new Error(await parseError(resp));
    }
    return (await resp.json()) as WebDirectoryListing;
};

export const uploadWebFiles = async (
    files: readonly File[],
    targetDir = 'inputs'
): Promise<WebFileEntry[]> => {
    const form = new FormData();
    form.append('dir', targetDir);
    files.forEach((file) => {
        form.append('file', file, file.name);
    });

    const url = `${getWebBackendUrl()}/web/fs/upload`;
    const resp = await fetch(url, {
        method: 'POST',
        body: form,
        credentials: 'same-origin',
    });
    if (!resp.ok) {
        throw new Error(await parseError(resp));
    }
    const data = (await resp.json()) as { files: WebFileEntry[] };
    return data.files;
};

export const createWebDirectory = async (
    parentPath: string,
    name: string
): Promise<WebFileEntry> => {
    const url = `${getWebBackendUrl()}/web/fs/mkdir`;
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentPath, name }),
        credentials: 'same-origin',
    });
    if (!resp.ok) {
        throw new Error(await parseError(resp));
    }
    return (await resp.json()) as WebFileEntry;
};

export const getWebFileUrl = (filePath: string, download = false): string => {
    const params = new URLSearchParams({ path: filePath });
    if (download) {
        params.set('download', '1');
    }
    return `${getWebBackendUrl()}/web/fs/file?${params.toString()}`;
};

export const deleteWebEntry = async (targetPath: string): Promise<void> => {
    const url = `${getWebBackendUrl()}/web/fs/delete`;
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath }),
        credentials: 'same-origin',
    });
    if (!resp.ok) {
        throw new Error(await parseError(resp));
    }
};

export const renameWebEntry = async (
    targetPath: string,
    newName: string
): Promise<WebFileEntry> => {
    const url = `${getWebBackendUrl()}/web/fs/rename`;
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath, newName }),
        credentials: 'same-origin',
    });
    if (!resp.ok) {
        throw new Error(await parseError(resp));
    }
    return (await resp.json()) as WebFileEntry;
};

export const readWebTextFile = async (
    targetPath: string
): Promise<{ name: string; path: string; relativePath: string; content: string }> => {
    const params = new URLSearchParams({ path: targetPath });
    const url = `${getWebBackendUrl()}/web/fs/read-text?${params.toString()}`;
    const resp = await fetch(url, { credentials: 'same-origin' });
    if (!resp.ok) {
        throw new Error(await parseError(resp));
    }
    return (await resp.json()) as {
        name: string;
        path: string;
        relativePath: string;
        content: string;
    };
};

export const writeWebTextFile = async (
    targetPath: string,
    content: string
): Promise<WebFileEntry> => {
    const url = `${getWebBackendUrl()}/web/fs/write-text`;
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath, content }),
        credentials: 'same-origin',
    });
    if (!resp.ok) {
        throw new Error(await parseError(resp));
    }
    return (await resp.json()) as WebFileEntry;
};
