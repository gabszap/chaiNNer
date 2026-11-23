import path from 'path';
import { FileSaveResult, PythonInfo, Version } from '../common/common-types';
import { log } from '../common/log';
import { ChannelArgs, InvokeChannels, SendChannels } from '../common/safeIpc';
import { ChainnerSettings, defaultSettings } from '../common/settings/settings';
import { parseSaveFile, stringifySaveFile } from './saveFileWeb';
import { getWebBackendUrl, setWebBackendUrl } from './webConfig';
import { openRemoteFileDialog, openWebPromptDialog } from './webDialogs';
import type { SaveData } from '../main/SaveFile';
import type { FileFilter } from 'electron/common';

export { getWebBackendUrl, setWebBackendUrl };

const SETTINGS_STORAGE_KEY = 'chainner-web-settings';
const CLIPBOARD_BUFFER_PREFIX = 'chainner-web-clipboard:';

type ListenerFn = (event: unknown, ...args: unknown[]) => void;

const listeners = new Map<string, Set<ListenerFn>>();
const memoryClipboardBuffers = new Map<string, string>();

export const emitWebIpcEvent = <C extends keyof SendChannels>(
    channel: C,
    ...args: ChannelArgs<C>
): void => {
    const set = listeners.get(channel);
    if (!set) return;
    const fakeEvent = {};
    [...set].forEach((listener) => {
        listener(fakeEvent, ...args);
    });
};

const loadSettings = (): ChainnerSettings => {
    try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!raw) {
            return { ...defaultSettings, checkForUpdatesOnStartup: false };
        }
        const parsed = JSON.parse(raw) as Partial<ChainnerSettings>;
        return {
            ...defaultSettings,
            checkForUpdatesOnStartup: false,
            ...parsed,
        };
    } catch (error) {
        log.warn('Failed to parse stored web settings, falling back to defaults:', error);
        return { ...defaultSettings, checkForUpdatesOnStartup: false };
    }
};

const saveSettings = (settings: ChainnerSettings): void => {
    try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
        log.error('Failed to persist web settings:', error);
    }
};

const downloadChainFile = (saveData: SaveData, filename: string): void => {
    const version = window.appConstants.appVersion;
    const serialized = stringifySaveFile(saveData, version);
    const blob = new Blob([serialized], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename.endsWith('.chn') ? filename : `${filename}.chn`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};

export const openLocalChainFile = (): void => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.chn,.json';
    input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const saveData = parseSaveFile(text);
            emitWebIpcEvent('file-open', {
                kind: 'Success',
                path: file.name,
                saveData,
            });
        } catch (error) {
            emitWebIpcEvent('file-open', {
                kind: 'Error',
                path: file.name,
                error: String(error),
            });
        }
    };
    input.click();
};

const fetchPythonInfo = async (): Promise<PythonInfo> => {
    const backendUrl = getWebBackendUrl();
    try {
        const resp = await fetch(`${backendUrl}/python-info`, { credentials: 'same-origin' });
        if (resp.ok) {
            const data = (await resp.json()) as { python?: string; version?: string };
            if (data.python && data.version) {
                return {
                    python: data.python,
                    version: data.version as Version,
                };
            }
        }
    } catch (error) {
        log.warn('Could not fetch /python-info during web bootstrap, using fallback:', error);
    }
    return {
        python: 'remote-python',
        version: '3.11.0' as Version,
    };
};

const extractExtensions = (filters: FileFilter[] | undefined): string[] => {
    if (!Array.isArray(filters)) return [];
    const exts = new Set<string>();
    filters.forEach((f) => {
        f.extensions.forEach((ext) => {
            const cleaned = ext.trim().replace(/^\./, '').toLowerCase();
            if (cleaned && cleaned !== '*') {
                exts.add(cleaned);
            }
        });
    });
    return [...exts];
};

const handleInvoke = async (
    channel: keyof InvokeChannels,
    ...args: unknown[]
): Promise<unknown> => {
    switch (channel) {
        case 'get-backend-url':
            return getWebBackendUrl();
        case 'get-python':
            return fetchPythonInfo();
        case 'get-settings':
            return loadSettings();
        case 'set-settings':
            saveSettings(args[0] as ChainnerSettings);
            return undefined;
        case 'owns-backend':
        case 'refresh-nodes':
            return false;
        case 'get-auto-open':
            return undefined;
        case 'open-url': {
            const url = String(args[0] ?? '');
            if (url) {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
            return undefined;
        }
        case 'file-save-json': {
            const saveData = args[0] as SaveData;
            const savePath = String(args[1] ?? 'chain.chn');
            downloadChainFile(saveData, savePath);
            return undefined;
        }
        case 'file-save-as-json': {
            const saveData = args[0] as SaveData;
            const defaultPath = typeof args[1] === 'string' && args[1] ? args[1] : 'chain.chn';
            const suggested = defaultPath.split(/[\\/]/).pop() || 'chain.chn';
            const chosen = await openWebPromptDialog({
                title: 'Salvar chain (.chn)',
                description: 'Escolha o nome do arquivo para download:',
                placeholder: 'minha-chain.chn',
                defaultValue: suggested,
                confirmLabel: 'Baixar .chn',
            });
            if (!chosen || !chosen.trim()) {
                return { kind: 'Canceled' } satisfies FileSaveResult;
            }
            const finalName = chosen.trim().endsWith('.chn')
                ? chosen.trim()
                : `${chosen.trim()}.chn`;
            downloadChainFile(saveData, finalName);
            return { kind: 'Success', path: finalName } satisfies FileSaveResult;
        }
        case 'file-select': {
            const filters = args[0] as FileFilter[] | undefined;
            const allowMultiple = Boolean(args[1]);
            const initialPath = typeof args[2] === 'string' && args[2] ? args[2] : undefined;
            const filterTitle = filters?.[0]?.name ? `Selecionar: ${filters[0].name}` : undefined;
            return openRemoteFileDialog({
                mode: 'file',
                title: filterTitle,
                initialPath,
                extensions: extractExtensions(filters),
                allowMultiple,
            });
        }
        case 'dir-select': {
            const initialPath = typeof args[0] === 'string' && args[0] ? args[0] : undefined;
            return openRemoteFileDialog({
                mode: 'directory',
                initialPath,
            });
        }
        case 'shell-showItemInFolder': {
            const fullPath = typeof args[0] === 'string' ? args[0] : '';
            if (fullPath) {
                await openRemoteFileDialog({
                    mode: 'browse',
                    title: 'Arquivos do servidor',
                    initialPath: path.dirname(fullPath),
                    highlightPath: fullPath,
                });
            }
            return undefined;
        }
        case 'clipboard-writeBuffer-fromString': {
            const format = String(args[0] ?? '');
            const json = String(args[1] ?? '');
            memoryClipboardBuffers.set(format, json);
            try {
                sessionStorage.setItem(`${CLIPBOARD_BUFFER_PREFIX}${format}`, json);
            } catch {
                // Ignore quota errors in sessionStorage
            }
            return undefined;
        }
        case 'clipboard-readBuffer-toString': {
            const format = String(args[0] ?? '');
            const mem = memoryClipboardBuffers.get(format);
            if (mem !== undefined) return mem;
            return sessionStorage.getItem(`${CLIPBOARD_BUFFER_PREFIX}${format}`) ?? '';
        }
        case 'clipboard-availableFormats':
            // Empty array signals copyAndPaste.ts to read 'application/chainner.chain'
            return [];
        case 'clipboard-writeText': {
            const text = String(args[0] ?? '');
            await navigator.clipboard.writeText(text);
            return undefined;
        }
        case 'clipboard-readText':
            return navigator.clipboard.readText();
        case 'clipboard-readHTML':
        case 'clipboard-readRTF':
            return '';
        case 'fs-exists':
            return false;
        case 'fs-readdir':
            return [];
        case 'fs-read-file':
            return '';
        case 'fs-write-file':
        case 'fs-mkdir':
        case 'fs-unlink':
        case 'fs-access':
        case 'watch-file':
        case 'watch-files':
        case 'unwatch-file':
        case 'unwatch-files':
        case 'shell-openPath':
        case 'restart-backend':
        case 'relaunch-application':
        case 'quit-application':
        case 'app-quit':
        case 'open-dropped-save-file':
        case 'clipboard-writeImageFromURL':
            return undefined;
        default:
            log.debug(`[WebIPC] Unhandled invoke channel: ${String(channel)}`);
            return undefined;
    }
};

export const createWebIpcRenderer = (): Electron.IpcRenderer => {
    const shim = {
        invoke: (channel: string, ...args: unknown[]) =>
            handleInvoke(channel as keyof InvokeChannels, ...args),
        on: (channel: string, listener: ListenerFn) => {
            let set = listeners.get(channel);
            if (!set) {
                set = new Set();
                listeners.set(channel, set);
            }
            set.add(listener);
            return shim;
        },
        once: (channel: string, listener: ListenerFn) => {
            const wrapper: ListenerFn = (event, ...args) => {
                listeners.get(channel)?.delete(wrapper);
                listener(event, ...args);
            };
            return shim.on(channel, wrapper);
        },
        removeListener: (channel: string, listener: ListenerFn) => {
            listeners.get(channel)?.delete(listener);
            return shim;
        },
        removeAllListeners: (channel: string) => {
            listeners.delete(channel);
            return shim;
        },
        send: (channel: string, ...args: unknown[]) => {
            log.debug(`[WebIPC] send(${channel})`, ...args);
        },
        sendSync: (channel: string): unknown => {
            switch (channel) {
                case 'get-app-version-sync':
                    return window.appConstants.appVersion;
                case 'get-is-mac-sync':
                    return window.appConstants.isMac;
                case 'get-is-arm-mac-sync':
                    return window.appConstants.isArmMac;
                case 'get-appdata-sync':
                    return window.appConstants.appDataPath;
                default:
                    return undefined;
            }
        },
        postMessage: () => undefined,
        sendToHost: () => undefined,
    };

    return shim as unknown as Electron.IpcRenderer;
};
