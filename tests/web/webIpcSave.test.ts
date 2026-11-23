import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Version } from '../../src/common/common-types';
import { registerWebDialogHandlers } from '../../src/web/webDialogs';
import { createWebIpcRenderer, triggerDownloadChainAs } from '../../src/web/webIpc';
import type { SaveData } from '../../src/main/SaveFile';

const sampleSaveData: SaveData = {
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
};

describe('webIpc save/load flows', () => {
    const fetchMock = vi.fn();
    const clickMock = vi.fn();
    const removeMock = vi.fn();
    const appendChildMock = vi.fn();

    beforeEach(() => {
        fetchMock.mockReset();
        clickMock.mockReset();
        removeMock.mockReset();
        appendChildMock.mockReset();

        vi.stubGlobal('fetch', fetchMock);
        vi.stubGlobal('localStorage', {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
        });
        vi.stubGlobal('window', {
            appConstants: {
                appVersion: '0.26.1' as Version,
                isMac: false,
                isArmMac: false,
                appDataPath: '/web-appdata',
            },
        });
        vi.stubGlobal('URL', {
            createObjectURL: () => 'blob:mock-chain',
            revokeObjectURL: () => undefined,
        });
        vi.stubGlobal('document', {
            createElement: () => ({
                href: '',
                download: '',
                click: clickMock,
                remove: removeMock,
            }),
            body: {
                appendChild: appendChildMock,
            },
        });
    });

    afterEach(() => {
        registerWebDialogHandlers(null);
        vi.unstubAllGlobals();
    });

    it('file-save-json ALWAYS writes to the server even when savePath has no slashes', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ path: '/data/chainner/chains/chain.chn' }),
        });

        const ipc = createWebIpcRenderer();
        await ipc.invoke('file-save-json', sampleSaveData, 'chain.chn');

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('/api/web/fs/write-text');
        expect(init.method).toBe('POST');
        const body = JSON.parse(String(init.body)) as { path: string; content: string };
        expect(body.path).toBe('chains/chain.chn');
        expect(JSON.parse(body.content)).toHaveProperty('version', '0.26.1');
        // Never triggers a browser file download
        expect(clickMock).not.toHaveBeenCalled();
    });

    it('file-save-as-json writes to server chains/ by default and returns server path', async () => {
        registerWebDialogHandlers({
            openFileBrowser: () => Promise.resolve({ canceled: true, filePaths: [] }),
            openPrompt: () => Promise.resolve('meu-upscale'),
        });
        fetchMock.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ path: '/data/chainner/chains/meu-upscale.chn' }),
        });

        const ipc = createWebIpcRenderer();
        const result = (await ipc.invoke('file-save-as-json', sampleSaveData, undefined)) as {
            kind: string;
            path?: string;
        };

        expect(result).toEqual({ kind: 'Success', path: '/data/chainner/chains/meu-upscale.chn' });
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('/api/web/fs/write-text');
        const body = JSON.parse(String(init.body)) as { path: string };
        expect(body.path).toBe('chains/meu-upscale.chn');
        expect(clickMock).not.toHaveBeenCalled();
    });

    it('triggerDownloadChainAs downloads locally without touching the server or overriding savePath', async () => {
        registerWebDialogHandlers({
            openFileBrowser: () => Promise.resolve({ canceled: true, filePaths: [] }),
            openPrompt: () => Promise.resolve('backup-local.chn'),
        });

        const ipc = createWebIpcRenderer();
        triggerDownloadChainAs();
        const result = (await ipc.invoke(
            'file-save-as-json',
            sampleSaveData,
            '/data/chainner/chains/upscale.chn'
        )) as { kind: string };

        expect(fetchMock).not.toHaveBeenCalled();
        expect(clickMock).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ kind: 'Canceled' });
    });
});
