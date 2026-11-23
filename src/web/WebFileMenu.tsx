/* eslint-disable i18next/no-literal-string */
import {
    Box,
    Button,
    HStack,
    IconButton,
    Menu,
    MenuButton,
    MenuDivider,
    MenuItem,
    MenuList,
    Tooltip,
} from '@chakra-ui/react';
import { memo, useCallback } from 'react';
import {
    MdCameraAlt,
    MdCloudDone,
    MdContentCopy,
    MdCreateNewFolder,
    MdDownload,
    MdFolder,
    MdFolderOpen,
    MdMenu,
    MdRedo,
    MdSave,
    MdSaveAs,
    MdSettingsEthernet,
    MdUndo,
    MdUploadFile,
} from 'react-icons/md';
import { useContextSelector } from 'use-context-selector';
import { BackendContext } from '../renderer/contexts/BackendContext';
import { getWebBackendUrl, setWebBackendUrl } from './webConfig';
import { WebDialogHost } from './WebDialogHost';
import { openRemoteFileDialog, openWebPromptDialog } from './webDialogs';
import {
    emitWebIpcEvent,
    openLocalChainFile,
    openServerChainFile,
    triggerDownloadChainAs,
} from './webIpc';

export const WebFileMenu = memo(() => {
    const connectionState = useContextSelector(BackendContext, (c) => c.connectionState);
    const isBackendReady = useContextSelector(BackendContext, (c) => c.isBackendReady);
    const backendUrl = useContextSelector(BackendContext, (c) => c.url);

    const handleNew = useCallback(() => {
        emitWebIpcEvent('file-new');
    }, []);

    const handleOpenServer = useCallback(() => {
        openServerChainFile().catch(() => undefined);
    }, []);

    const handleOpenLocal = useCallback(() => {
        openLocalChainFile();
    }, []);

    const handleSave = useCallback(() => {
        emitWebIpcEvent('file-save');
    }, []);

    const handleSaveAs = useCallback(() => {
        emitWebIpcEvent('file-save-as');
    }, []);

    const handleDownloadLocal = useCallback(() => {
        triggerDownloadChainAs();
    }, []);

    const handleExportTemplate = useCallback(() => {
        emitWebIpcEvent('file-export-template');
    }, []);

    const handleExportImageFile = useCallback(() => {
        emitWebIpcEvent('export-viewport', 'file');
    }, []);

    const handleExportImageClipboard = useCallback(() => {
        emitWebIpcEvent('export-viewport', 'clipboard');
    }, []);

    const handleUndo = useCallback(() => {
        emitWebIpcEvent('history-undo');
    }, []);

    const handleRedo = useCallback(() => {
        emitWebIpcEvent('history-redo');
    }, []);

    const handleBrowseFiles = useCallback(() => {
        openRemoteFileDialog({
            mode: 'browse',
            title: 'Arquivos do servidor',
            initialPath: 'outputs',
        }).catch(() => undefined);
    }, []);

    const handleBackendUrl = useCallback(() => {
        const current = getWebBackendUrl();
        openWebPromptDialog({
            title: 'URL do backend chaiNNer',
            description:
                'Informe a URL base do backend (deixe vazio para voltar ao padrão /api via proxy).',
            placeholder: '/api',
            defaultValue: current,
            confirmLabel: 'Salvar e recarregar',
        })
            .then((next) => {
                if (next === null) return;
                setWebBackendUrl(next);
                window.location.reload();
            })
            .catch(() => undefined);
    }, []);

    if (!window.isWebUI) {
        return null;
    }

    let statusColor = 'yellow.400';
    let statusLabel = `Conectando ao backend (${backendUrl})…`;
    if (connectionState === 'connected' && isBackendReady) {
        statusColor = 'green.400';
        statusLabel = `Backend conectado (${backendUrl})`;
    } else if (connectionState === 'failed') {
        statusColor = 'red.400';
        statusLabel = `Falha na conexão com o backend (${backendUrl})`;
    }

    return (
        <>
            <Menu isLazy>
                <MenuButton
                    aria-label="Menu da chain"
                    as={Button}
                    leftIcon={<MdMenu />}
                    size="sm"
                    variant="outline"
                >
                    Menu
                </MenuButton>
                <MenuList zIndex={2000}>
                    <MenuItem
                        command="Ctrl+Alt+N"
                        icon={<MdCreateNewFolder />}
                        onClick={handleNew}
                    >
                        Nova chain
                    </MenuItem>
                    <MenuItem
                        icon={<MdCloudDone />}
                        onClick={handleOpenServer}
                    >
                        Abrir .chn do servidor...
                    </MenuItem>
                    <MenuItem
                        command="Ctrl+O"
                        icon={<MdUploadFile />}
                        onClick={handleOpenLocal}
                    >
                        Abrir .chn do PC...
                    </MenuItem>
                    <MenuDivider />
                    <MenuItem
                        command="Ctrl+S"
                        icon={<MdSave />}
                        onClick={handleSave}
                    >
                        Salvar .chn (servidor)
                    </MenuItem>
                    <MenuItem
                        command="Ctrl+Shift+S"
                        icon={<MdSaveAs />}
                        onClick={handleSaveAs}
                    >
                        Salvar como (servidor)...
                    </MenuItem>
                    <MenuItem
                        icon={<MdDownload />}
                        onClick={handleDownloadLocal}
                    >
                        Baixar .chn no PC...
                    </MenuItem>
                    <MenuItem
                        icon={<MdFolderOpen />}
                        onClick={handleExportTemplate}
                    >
                        Exportar template
                    </MenuItem>
                    <MenuDivider />
                    <MenuItem
                        command="Ctrl+P"
                        icon={<MdCameraAlt />}
                        onClick={handleExportImageFile}
                    >
                        Exportar imagem da chain (.png)
                    </MenuItem>
                    <MenuItem
                        command="Ctrl+Shift+P"
                        icon={<MdContentCopy />}
                        onClick={handleExportImageClipboard}
                    >
                        Copiar imagem da chain
                    </MenuItem>
                    <MenuDivider />
                    <MenuItem
                        icon={<MdFolder />}
                        onClick={handleBrowseFiles}
                    >
                        Arquivos do servidor...
                    </MenuItem>
                    <MenuItem
                        icon={<MdSettingsEthernet />}
                        onClick={handleBackendUrl}
                    >
                        Configurar URL do backend...
                    </MenuItem>
                </MenuList>
            </Menu>
            <Tooltip label="Arquivos do servidor (inputs / outputs / models / chains)">
                <Button
                    leftIcon={<MdFolder />}
                    size="sm"
                    variant="ghost"
                    onClick={handleBrowseFiles}
                >
                    Arquivos
                </Button>
            </Tooltip>
            <Tooltip label="Desfazer (Ctrl+Z)">
                <IconButton
                    aria-label="Desfazer"
                    icon={<MdUndo />}
                    size="sm"
                    variant="ghost"
                    onClick={handleUndo}
                />
            </Tooltip>
            <Tooltip label="Refazer (Ctrl+Y)">
                <IconButton
                    aria-label="Refazer"
                    icon={<MdRedo />}
                    size="sm"
                    variant="ghost"
                    onClick={handleRedo}
                />
            </Tooltip>
            <Tooltip label={statusLabel}>
                <HStack
                    aria-label={statusLabel}
                    px={1}
                    spacing={1}
                >
                    <Box
                        bg={statusColor}
                        borderRadius="full"
                        boxShadow={
                            connectionState === 'connected' && isBackendReady
                                ? '0 0 6px var(--chakra-colors-green-400)'
                                : undefined
                        }
                        h="8px"
                        w="8px"
                    />
                </HStack>
            </Tooltip>
            <WebDialogHost />
        </>
    );
});
