/* eslint-disable i18next/no-literal-string */
import {
    Button,
    Input,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    Text,
} from '@chakra-ui/react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { RemoteFileBrowserModal } from './RemoteFileBrowserModal';
import {
    RemoteFileDialogOptions,
    RemoteFileDialogResult,
    WebPromptDialogOptions,
    registerWebDialogHandlers,
} from './webDialogs';

interface ActiveFileDialog {
    options: RemoteFileDialogOptions;
    resolve: (result: RemoteFileDialogResult) => void;
}

interface ActivePromptDialog {
    options: WebPromptDialogOptions;
    resolve: (value: string | null) => void;
}

export const WebDialogHost = memo(() => {
    const [fileDialog, setFileDialog] = useState<ActiveFileDialog | null>(null);
    const [promptDialog, setPromptDialog] = useState<ActivePromptDialog | null>(null);
    const [promptValue, setPromptValue] = useState('');
    const promptInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        registerWebDialogHandlers({
            openFileBrowser: (options) =>
                new Promise<RemoteFileDialogResult>((resolve) => {
                    setFileDialog({ options, resolve });
                }),
            openPrompt: (options) =>
                new Promise<string | null>((resolve) => {
                    setPromptValue(options.defaultValue ?? '');
                    setPromptDialog({ options, resolve });
                }),
        });
        return () => {
            registerWebDialogHandlers(null);
        };
    }, []);

    const handleFileDialogClose = useCallback(
        (result: RemoteFileDialogResult) => {
            fileDialog?.resolve(result);
            setFileDialog(null);
        },
        [fileDialog]
    );

    const handlePromptCancel = useCallback(() => {
        promptDialog?.resolve(null);
        setPromptDialog(null);
    }, [promptDialog]);

    const handlePromptConfirm = useCallback(() => {
        promptDialog?.resolve(promptValue);
        setPromptDialog(null);
    }, [promptDialog, promptValue]);

    return (
        <>
            <RemoteFileBrowserModal
                isOpen={fileDialog !== null}
                options={fileDialog?.options ?? null}
                onClose={handleFileDialogClose}
            />

            <Modal
                isCentered
                initialFocusRef={promptInputRef}
                isOpen={promptDialog !== null}
                size="md"
                onClose={handlePromptCancel}
            >
                <ModalOverlay bg="blackAlpha.700" />
                <ModalContent
                    bg="var(--bg-800)"
                    borderColor="var(--bg-600)"
                    borderWidth="1px"
                    color="var(--fg-000)"
                >
                    <ModalHeader fontSize="md">{promptDialog?.options.title ?? ''}</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        {promptDialog?.options.description && (
                            <Text
                                color="var(--fg-300)"
                                fontSize="sm"
                                mb={3}
                            >
                                {promptDialog.options.description}
                            </Text>
                        )}
                        <Input
                            bg="var(--bg-700)"
                            borderColor="var(--bg-600)"
                            placeholder={promptDialog?.options.placeholder}
                            ref={promptInputRef}
                            size="sm"
                            value={promptValue}
                            onChange={(e) => setPromptValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handlePromptConfirm();
                                }
                            }}
                        />
                    </ModalBody>
                    <ModalFooter gap={2}>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={handlePromptCancel}
                        >
                            Cancelar
                        </Button>
                        <Button
                            colorScheme="blue"
                            size="sm"
                            onClick={handlePromptConfirm}
                        >
                            {promptDialog?.options.confirmLabel ?? 'Confirmar'}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
});
