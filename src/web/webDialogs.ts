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

interface WebDialogHandlers {
    openFileBrowser: (options: RemoteFileDialogOptions) => Promise<RemoteFileDialogResult>;
    openPrompt: (options: WebPromptDialogOptions) => Promise<string | null>;
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
