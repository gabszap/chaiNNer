/* eslint-disable no-alert, i18next/no-literal-string */
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
    MdFolderOpen,
    MdMenu,
    MdRedo,
    MdSave,
    MdSaveAs,
    MdSettingsEthernet,
    MdUndo,
} from 'react-icons/md';
import { emitWebIpcEvent, getWebBackendUrl, openLocalChainFile, setWebBackendUrl } from './webIpc';

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

    const handleBackendUrl = useCallback(() => {
        const current = getWebBackendUrl();
        const next = window.prompt(
            'URL do backend chaiNNer (deixe vazio para usar o padrão /api):',
            current
        );
        if (next === null) return;
        setWebBackendUrl(next);
        window.location.reload();
    }, []);

    if (!window.isWebUI) {
        return null;
    }

    return (
        <>
            <Menu isLazy>
                <MenuButton
                    aria-label="Menu de arquivo"
                    as={Button}
                    leftIcon={<MdMenu />}
                    size="sm"
                    variant="outline"
                >
                    Arquivo
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
                        icon={<MdSettingsEthernet />}
                        onClick={handleBackendUrl}
                    >
                        Configurar URL do backend...
                    </MenuItem>
                </MenuList>
            </Menu>
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
        </>
    );
});
