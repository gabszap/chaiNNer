import { Version } from '../common/common-types';
import { createWebIpcRenderer, emitWebIpcEvent, openLocalChainFile } from './webIpc';

declare const CHAINNER_APP_VERSION: string | undefined;

const isTextInputFocused = (): boolean => {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName.toLowerCase();
    return (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        (active as HTMLElement).isContentEditable
    );
};

const registerWebShortcuts = (): void => {
    window.addEventListener('keydown', (event) => {
        const mod = event.ctrlKey || event.metaKey;
        if (!mod) return;

        const key = event.key.toLowerCase();
        if (key === 's') {
            event.preventDefault();
            emitWebIpcEvent(event.shiftKey ? 'file-save-as' : 'file-save');
            return;
        }
        if (key === 'o') {
            event.preventDefault();
            openLocalChainFile();
            return;
        }
        if (!isTextInputFocused() && event.altKey && key === 'n') {
            event.preventDefault();
            emitWebIpcEvent('file-new');
        }
    });
};

export const installWebShims = (): void => {
    if (window.isWebUI) return;

    const appVersion = (
        typeof CHAINNER_APP_VERSION === 'string' ? CHAINNER_APP_VERSION : '0.26.1'
    ) as Version;
    const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

    window.isWebUI = true;
    window.appConstants = {
        appVersion,
        isMac,
        isArmMac: false,
        appDataPath: '/web-appdata',
    };
    window.electronFileUtils = {
        getPathForFile: (file: File): string => file.name,
    };
    window.unsafeIpcRenderer = createWebIpcRenderer();

    registerWebShortcuts();
};
