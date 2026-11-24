export type RemoteFileDialogMode = 'file' | 'directory' | 'browse';

export interface RemoteFileDialogOptions {
    mode: RemoteFileDialogMode;
    title?: string;
    initialPath?: string;
    extensions?: readonly string[];
    allowMultiple?: boolean;
    highlightPath?: string;
}

export interface RemoteFileDialogResult {
    canceled: boolean;
    filePaths: string[];
}

export interface WebPromptDialogOptions {
    title: string;
    description?: string;
    placeholder?: string;
    defaultValue?: string;
    confirmLabel?: string;
}

export interface WebToastOptions {
    title?: string;
    description: string;
    status: 'success' | 'info' | 'warning' | 'error';
    duration?: number;
}

interface WebDialogHandlers {
    openFileBrowser: (options: RemoteFileDialogOptions) => Promise<RemoteFileDialogResult>;
    openPrompt: (options: WebPromptDialogOptions) => Promise<string | null>;
    showToast?: (options: WebToastOptions) => void;
}

let registeredHandlers: WebDialogHandlers | null = null;

export const registerWebDialogHandlers = (handlers: WebDialogHandlers | null): void => {
    registeredHandlers = handlers;
};

export const openRemoteFileDialog = (
    options: RemoteFileDialogOptions
): Promise<RemoteFileDialogResult> => {
    if (!registeredHandlers) {
        return Promise.resolve({ canceled: true, filePaths: [] });
    }
    return registeredHandlers.openFileBrowser(options);
};

export const openWebPromptDialog = (options: WebPromptDialogOptions): Promise<string | null> => {
    if (!registeredHandlers) {
        return Promise.resolve(null);
    }
    return registeredHandlers.openPrompt(options);
};

export const showWebToast = (options: WebToastOptions): void => {
    registeredHandlers?.showToast?.(options);
};
