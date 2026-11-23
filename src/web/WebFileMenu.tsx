/* eslint-disable i18next/no-literal-string */
import {
    Button,
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
    MdCreateNewFolder,
    MdFolder,
    MdFolderOpen,
    MdMenu,
    MdRedo,
    MdSave,
    MdSaveAs,
    MdSettingsEthernet,
    MdUndo,
} from 'react-icons/md';
import { getWebBackendUrl, setWebBackendUrl } from './webConfig';
import { WebDialogHost } from './WebDialogHost';
import { openRemoteFileDialog, openWebPromptDialog } from './webDialogs';
import { emitWebIpcEvent, openLocalChainFile } from './webIpc';

export const WebFileMenu = memo(() => {
    const handleNew = useCallback(() => {
        emitWebIpcEvent('file-new');
    }, []);

    const handleOpen = useCallback(() => {
        openLocalChainFile();
    }, []);

    const handleSave = useCallback(() => {
        emitWebIpcEvent('file-save');
    }, []);

    const handleSaveAs = useCallback(() => {
        emitWebIpcEvent('file-save-as');
    }, []);

    const handleExportTemplate = useCallback(() => {
        emitWebIpcEvent('file-export-template');
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
                        command="Ctrl+O"
                        icon={<MdFolderOpen />}
                        onClick={handleOpen}
                    >
                        Abrir .chn...
                    </MenuItem>
                    <MenuItem
                        command="Ctrl+S"
                        icon={<MdSave />}
                        onClick={handleSave}
                    >
                        Salvar .chn
                    </MenuItem>
                    <MenuItem
                        command="Ctrl+Shift+S"
                        icon={<MdSaveAs />}
                        onClick={handleSaveAs}
                    >
                        Salvar como...
                    </MenuItem>
                    <MenuItem
                        icon={<MdSaveAs />}
                        onClick={handleExportTemplate}
                    >
                        Exportar template
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
            <Tooltip label="Arquivos do servidor (inputs / outputs / models)">
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
            <WebDialogHost />
        </>
    );
});
