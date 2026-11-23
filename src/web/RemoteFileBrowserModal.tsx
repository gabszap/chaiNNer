/* eslint-disable i18next/no-literal-string */
import {
    Badge,
    Box,
    Button,
    Center,
    Checkbox,
    Flex,
    HStack,
    Icon,
    IconButton,
    Image,
    Input,
    InputGroup,
    InputLeftElement,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    Spinner,
    Text,
    Tooltip,
    VStack,
} from '@chakra-ui/react';
import { DragEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    MdArrowUpward,
    MdChevronRight,
    MdCloudUpload,
    MdCreateNewFolder,
    MdDownload,
    MdFolder,
    MdHome,
    MdImage,
    MdInsertDriveFile,
    MdMemory,
    MdOpenInNew,
    MdRefresh,
    MdSearch,
} from 'react-icons/md';
import { RemoteFileDialogOptions, RemoteFileDialogResult } from './webDialogs';
import {
    WebDirectoryListing,
    WebFileEntry,
    createWebDirectory,
    getWebFileUrl,
    listWebDirectory,
    uploadWebFiles,
} from './webFsClient';

interface RemoteFileBrowserModalProps {
    isOpen: boolean;
    options: RemoteFileDialogOptions | null;
    onClose: (result: RemoteFileDialogResult) => void;
}

const formatFileSize = (bytes: number): string => {
    if (bytes <= 0) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    let val = bytes;
    let idx = 0;
    while (val >= 1024 && idx < units.length - 1) {
        val /= 1024;
        idx += 1;
    }
    return `${val.toFixed(idx >= 2 ? 1 : 0)} ${units[idx]}`;
};

const formatDate = (ms: number): string => {
    if (!ms) return '';
    return new Date(ms).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const getShortcutIcon = (id: string) => {
    switch (id) {
        case 'root':
            return MdHome;
        case 'models':
            return MdMemory;
        default:
            return MdFolder;
    }
};

export const RemoteFileBrowserModal = memo(
    ({ isOpen, options, onClose }: RemoteFileBrowserModalProps) => {
        const [listing, setListing] = useState<WebDirectoryListing | null>(null);
        const [loading, setLoading] = useState(false);
        const [uploading, setUploading] = useState(false);
        const [error, setError] = useState<string | null>(null);
        const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
        const [searchQuery, setSearchQuery] = useState('');
        const [showAllFiles, setShowAllFiles] = useState(false);
        const [isDragActive, setIsDragActive] = useState(false);
        const [creatingFolder, setCreatingFolder] = useState(false);
        const [newFolderName, setNewFolderName] = useState('');

        const fileUploadInputRef = useRef<HTMLInputElement>(null);

        const mode = options?.mode ?? 'file';
        const allowMultiple = Boolean(options?.allowMultiple && mode === 'file');
        const configuredExtensions = useMemo(
            () => (options?.extensions ?? []).filter((e) => e && e !== '*'),
            [options?.extensions]
        );
        const activeExtensions = useMemo(() => {
            if (mode !== 'file' || showAllFiles || configuredExtensions.length === 0) {
                return undefined;
            }
            return configuredExtensions;
        }, [mode, showAllFiles, configuredExtensions]);

        const fetchDirectory = useCallback(
            async (targetPath?: string, selectAfter?: string) => {
                setLoading(true);
                setError(null);
                try {
                    const data = await listWebDirectory(targetPath, activeExtensions);
                    setListing(data);
                    if (selectAfter) {
                        setSelectedPaths([selectAfter]);
                    } else {
                        setSelectedPaths([]);
                    }
                } catch (err) {
                    setError(err instanceof Error ? err.message : String(err));
                } finally {
                    setLoading(false);
                }
            },
            [activeExtensions]
        );

        useEffect(() => {
            if (!isOpen || !options) return;
            setSearchQuery('');
            setShowAllFiles(false);
            setCreatingFolder(false);
            setNewFolderName('');
            const defaultDir =
                options.initialPath || (options.mode === 'directory' ? 'outputs' : 'inputs');
            fetchDirectory(defaultDir, options.highlightPath).catch(() => undefined);
        }, [isOpen, options, fetchDirectory]);

        const filteredEntries = useMemo(() => {
            if (!listing) return [];
            const q = searchQuery.trim().toLowerCase();
            if (!q) return listing.entries;
            return listing.entries.filter((entry) => entry.name.toLowerCase().includes(q));
        }, [listing, searchQuery]);

        const primarySelectedEntry = useMemo((): WebFileEntry | null => {
            if (!listing || selectedPaths.length === 0) return null;
            const last = selectedPaths[selectedPaths.length - 1];
            return listing.entries.find((e) => e.path === last) ?? null;
        }, [listing, selectedPaths]);

        const handleCancel = useCallback(() => {
            onClose({ canceled: true, filePaths: [] });
        }, [onClose]);

        const handleConfirm = useCallback(() => {
            if (mode === 'browse') {
                onClose({ canceled: true, filePaths: [] });
                return;
            }
            if (mode === 'directory') {
                if (primarySelectedEntry?.isDir) {
                    onClose({ canceled: false, filePaths: [primarySelectedEntry.path] });
                } else if (listing?.currentPath) {
                    onClose({ canceled: false, filePaths: [listing.currentPath] });
                }
                return;
            }
            const fileOnlyPaths = selectedPaths.filter((p) => {
                const entry = listing?.entries.find((e) => e.path === p);
                return entry && !entry.isDir;
            });
            if (fileOnlyPaths.length > 0) {
                onClose({ canceled: false, filePaths: fileOnlyPaths });
            }
        }, [listing, mode, onClose, primarySelectedEntry, selectedPaths]);

        const handleEntryClick = useCallback(
            (entry: WebFileEntry, multiToggle: boolean) => {
                if (allowMultiple && !entry.isDir && multiToggle) {
                    setSelectedPaths((prev) =>
                        prev.includes(entry.path)
                            ? prev.filter((p) => p !== entry.path)
                            : [...prev, entry.path]
                    );
                    return;
                }
                setSelectedPaths([entry.path]);
            },
            [allowMultiple]
        );

        const handleEntryDoubleClick = useCallback(
            (entry: WebFileEntry) => {
                if (entry.isDir) {
                    fetchDirectory(entry.path).catch(() => undefined);
                    return;
                }
                if (mode === 'file') {
                    onClose({ canceled: false, filePaths: [entry.path] });
                }
            },
            [fetchDirectory, mode, onClose]
        );

        const handleUploadFiles = useCallback(
            async (files: FileList | File[] | null) => {
                if (!files || files.length === 0) return;
                const list = Array.from(files);
                const destDir = listing?.currentPath || 'inputs';
                setUploading(true);
                setError(null);
                try {
                    const uploaded = await uploadWebFiles(list, destDir);
                    const firstUploaded = uploaded[0]?.path;
                    await fetchDirectory(destDir, firstUploaded);
                } catch (err) {
                    setError(err instanceof Error ? err.message : String(err));
                } finally {
                    setUploading(false);
                }
            },
            [fetchDirectory, listing?.currentPath]
        );

        const handleCreateFolder = useCallback(async () => {
            const name = newFolderName.trim();
            if (!name || !listing) return;
            setError(null);
            try {
                const created = await createWebDirectory(listing.currentPath, name);
                setCreatingFolder(false);
                setNewFolderName('');
                await fetchDirectory(listing.currentPath, created.path);
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
            }
        }, [fetchDirectory, listing, newFolderName]);

        const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
            if (event.dataTransfer.types.includes('Files')) {
                event.preventDefault();
                event.stopPropagation();
                setIsDragActive(true);
            }
        }, []);

        const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            setIsDragActive(false);
        }, []);

        const handleDrop = useCallback(
            (event: DragEvent<HTMLDivElement>) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDragActive(false);
                if (event.dataTransfer.files.length > 0) {
                    handleUploadFiles(event.dataTransfer.files).catch(() => undefined);
                }
            },
            [handleUploadFiles]
        );

        const modalTitle = useMemo(() => {
            if (options?.title) return options.title;
            if (mode === 'directory') return 'Selecionar pasta no servidor';
            if (mode === 'browse') return 'Arquivos do servidor';
            return allowMultiple
                ? 'Selecionar arquivos no servidor'
                : 'Selecionar arquivo no servidor';
        }, [allowMultiple, mode, options?.title]);

        const canConfirm = useMemo(() => {
            if (mode === 'browse') return true;
            if (mode === 'directory') return Boolean(listing?.currentPath);
            return selectedPaths.some((p) => {
                const entry = listing?.entries.find((e) => e.path === p);
                return Boolean(entry && !entry.isDir);
            });
        }, [listing, mode, selectedPaths]);

        return (
            <Modal
                isCentered
                isOpen={isOpen}
                scrollBehavior="inside"
                size="5xl"
                onClose={handleCancel}
            >
                <ModalOverlay bg="blackAlpha.700" />
                <ModalContent
                    bg="var(--bg-800)"
                    borderColor="var(--bg-600)"
                    borderWidth="1px"
                    color="var(--fg-000)"
                    h="78vh"
                    maxH="760px"
                >
                    <ModalHeader
                        borderBottomColor="var(--bg-700)"
                        borderBottomWidth="1px"
                        pb={3}
                        pt={4}
                    >
                        <HStack justify="space-between">
                            <HStack spacing={2}>
                                <Icon
                                    as={MdFolder}
                                    color="var(--type-color-directory)"
                                />
                                <Text fontSize="md">{modalTitle}</Text>
                                {mode === 'file' && configuredExtensions.length > 0 && (
                                    <Badge
                                        colorScheme="blue"
                                        fontSize="xs"
                                        variant="subtle"
                                    >
                                        {configuredExtensions.slice(0, 5).join(', ')}
                                        {configuredExtensions.length > 5 ? '…' : ''}
                                    </Badge>
                                )}
                            </HStack>
                        </HStack>
                    </ModalHeader>
                    <ModalCloseButton />

                    <ModalBody
                        display="flex"
                        flexDirection="column"
                        gap={3}
                        overflow="hidden"
                        py={3}
                    >
                        {/* Toolbar: navegação, breadcrumbs, upload e nova pasta */}
                        <Flex
                            align="center"
                            gap={2}
                            wrap="wrap"
                        >
                            <Tooltip label="Subir uma pasta">
                                <IconButton
                                    aria-label="Subir uma pasta"
                                    icon={<MdArrowUpward />}
                                    isDisabled={!listing?.parentPath || loading}
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        if (listing?.parentPath) {
                                            fetchDirectory(listing.parentPath).catch(
                                                () => undefined
                                            );
                                        }
                                    }}
                                />
                            </Tooltip>
                            <Tooltip label="Atualizar">
                                <IconButton
                                    aria-label="Atualizar"
                                    icon={<MdRefresh />}
                                    isDisabled={loading}
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        fetchDirectory(listing?.currentPath).catch(() => undefined);
                                    }}
                                />
                            </Tooltip>

                            {/* Breadcrumbs */}
                            <HStack
                                bg="var(--bg-700)"
                                borderRadius="md"
                                flex={1}
                                minW="220px"
                                overflowX="auto"
                                px={2}
                                py={1}
                                spacing={1}
                            >
                                {(listing?.breadcrumbs ?? []).map((crumb, idx) => (
                                    <HStack
                                        flexShrink={0}
                                        key={crumb.path}
                                        spacing={1}
                                    >
                                        {idx > 0 && (
                                            <Icon
                                                as={MdChevronRight}
                                                color="var(--fg-300)"
                                            />
                                        )}
                                        <Button
                                            size="xs"
                                            variant="ghost"
                                            onClick={() => {
                                                fetchDirectory(crumb.path).catch(() => undefined);
                                            }}
                                        >
                                            {crumb.name}
                                        </Button>
                                    </HStack>
                                ))}
                            </HStack>

                            <Button
                                leftIcon={<MdCreateNewFolder />}
                                size="sm"
                                variant="outline"
                                onClick={() => setCreatingFolder((prev) => !prev)}
                            >
                                Nova pasta
                            </Button>

                            <Button
                                colorScheme="blue"
                                isLoading={uploading}
                                leftIcon={<MdCloudUpload />}
                                loadingText="Enviando…"
                                size="sm"
                                onClick={() => fileUploadInputRef.current?.click()}
                            >
                                Enviar arquivo
                            </Button>
                            <input
                                multiple
                                ref={fileUploadInputRef}
                                style={{ display: 'none' }}
                                type="file"
                                onChange={(e) => {
                                    handleUploadFiles(e.target.files).catch(() => undefined);
                                    e.target.value = '';
                                }}
                            />
                        </Flex>

                        {creatingFolder && (
                            <HStack
                                bg="var(--bg-700)"
                                borderRadius="md"
                                p={2}
                            >
                                <Input
                                    autoFocus
                                    placeholder="Nome da nova pasta..."
                                    size="sm"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleCreateFolder().catch(() => undefined);
                                        } else if (e.key === 'Escape') {
                                            setCreatingFolder(false);
                                        }
                                    }}
                                />
                                <Button
                                    colorScheme="blue"
                                    size="sm"
                                    onClick={() => {
                                        handleCreateFolder().catch(() => undefined);
                                    }}
                                >
                                    Criar
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setCreatingFolder(false)}
                                >
                                    Cancelar
                                </Button>
                            </HStack>
                        )}

                        {/* Busca local + filtro de extensões */}
                        <HStack spacing={3}>
                            <InputGroup size="sm">
                                <InputLeftElement pointerEvents="none">
                                    <Icon
                                        as={MdSearch}
                                        color="var(--fg-300)"
                                    />
                                </InputLeftElement>
                                <Input
                                    bg="var(--bg-700)"
                                    borderColor="var(--bg-600)"
                                    placeholder="Filtrar arquivos nesta pasta..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </InputGroup>
                            {mode === 'file' && configuredExtensions.length > 0 && (
                                <Checkbox
                                    flexShrink={0}
                                    isChecked={showAllFiles}
                                    size="sm"
                                    onChange={(e) => setShowAllFiles(e.target.checked)}
                                >
                                    Mostrar todos
                                </Checkbox>
                            )}
                        </HStack>

                        {error && (
                            <Box
                                bg="red.900"
                                borderRadius="md"
                                color="red.100"
                                fontSize="sm"
                                px={3}
                                py={2}
                            >
                                {error}
                            </Box>
                        )}

                        {/* Corpo 3 colunas: Atalhos | Lista (Dropzone) | Preview */}
                        <Flex
                            flex={1}
                            gap={3}
                            minH={0}
                            overflow="hidden"
                        >
                            {/* Atalhos */}
                            <VStack
                                align="stretch"
                                bg="var(--bg-700)"
                                borderRadius="md"
                                flexShrink={0}
                                p={2}
                                spacing={1}
                                w="150px"
                            >
                                <Text
                                    color="var(--fg-300)"
                                    fontSize="xs"
                                    fontWeight="bold"
                                    px={2}
                                    py={1}
                                    textTransform="uppercase"
                                >
                                    Pastas
                                </Text>
                                {(listing?.shortcuts ?? []).map((sc) => {
                                    const active = listing?.currentPath === sc.path;
                                    return (
                                        <Button
                                            justifyContent="flex-start"
                                            key={sc.id}
                                            leftIcon={<Icon as={getShortcutIcon(sc.id)} />}
                                            size="sm"
                                            variant={active ? 'solid' : 'ghost'}
                                            onClick={() => {
                                                fetchDirectory(sc.path).catch(() => undefined);
                                            }}
                                        >
                                            {sc.name}
                                        </Button>
                                    );
                                })}
                            </VStack>

                            {/* Lista de arquivos com drag-and-drop */}
                            <Box
                                bg="var(--bg-700)"
                                borderColor={isDragActive ? 'blue.400' : 'var(--bg-600)'}
                                borderRadius="md"
                                borderStyle={isDragActive ? 'dashed' : 'solid'}
                                borderWidth={isDragActive ? '2px' : '1px'}
                                flex={1}
                                minW={0}
                                overflowY="auto"
                                p={2}
                                position="relative"
                                onDragLeave={handleDragLeave}
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                            >
                                {loading && (
                                    <Center h="full">
                                        <Spinner />
                                    </Center>
                                )}

                                {!loading && filteredEntries.length === 0 && (
                                    <Center
                                        color="var(--fg-300)"
                                        flexDirection="column"
                                        gap={2}
                                        h="full"
                                        p={6}
                                        textAlign="center"
                                    >
                                        <Icon
                                            as={MdCloudUpload}
                                            boxSize={8}
                                            opacity={0.7}
                                        />
                                        <Text fontSize="sm">
                                            Pasta vazia. Arraste arquivos do seu PC aqui ou clique
                                            em <strong>Enviar arquivo</strong>.
                                        </Text>
                                    </Center>
                                )}

                                {!loading && filteredEntries.length > 0 && (
                                    <VStack
                                        align="stretch"
                                        spacing={1}
                                    >
                                        {filteredEntries.map((entry) => {
                                            const isSelected = selectedPaths.includes(entry.path);
                                            let entryIcon = MdInsertDriveFile;
                                            let iconColor = 'var(--fg-300)';
                                            if (entry.isDir) {
                                                entryIcon = MdFolder;
                                                iconColor = 'var(--type-color-directory)';
                                            } else if (entry.isImage) {
                                                entryIcon = MdImage;
                                                iconColor = 'var(--type-color-image)';
                                            }

                                            return (
                                                <HStack
                                                    _hover={{
                                                        bg: isSelected
                                                            ? 'blue.700'
                                                            : 'whiteAlpha.100',
                                                    }}
                                                    bg={isSelected ? 'blue.700' : 'transparent'}
                                                    borderRadius="md"
                                                    cursor="pointer"
                                                    key={entry.path}
                                                    px={2}
                                                    py={1.5}
                                                    spacing={2}
                                                    userSelect="none"
                                                    onClick={(e) =>
                                                        handleEntryClick(
                                                            entry,
                                                            e.ctrlKey || e.metaKey
                                                        )
                                                    }
                                                    onDoubleClick={() =>
                                                        handleEntryDoubleClick(entry)
                                                    }
                                                >
                                                    <Icon
                                                        as={entryIcon}
                                                        boxSize={4}
                                                        color={iconColor}
                                                        flexShrink={0}
                                                    />
                                                    <Text
                                                        isTruncated
                                                        flex={1}
                                                        fontSize="sm"
                                                        title={entry.name}
                                                    >
                                                        {entry.name}
                                                    </Text>
                                                    <Text
                                                        color="var(--fg-300)"
                                                        flexShrink={0}
                                                        fontSize="xs"
                                                        textAlign="right"
                                                        w="68px"
                                                    >
                                                        {entry.isDir
                                                            ? 'Pasta'
                                                            : formatFileSize(entry.size)}
                                                    </Text>
                                                    <Text
                                                        color="var(--fg-300)"
                                                        display={{ base: 'none', md: 'block' }}
                                                        flexShrink={0}
                                                        fontSize="xs"
                                                        textAlign="right"
                                                        w="108px"
                                                    >
                                                        {formatDate(entry.modifiedMs)}
                                                    </Text>
                                                </HStack>
                                            );
                                        })}
                                    </VStack>
                                )}
                            </Box>

                            {/* Painel direito: preview / detalhes */}
                            <VStack
                                align="stretch"
                                bg="var(--bg-700)"
                                borderRadius="md"
                                display={{ base: 'none', lg: 'flex' }}
                                flexShrink={0}
                                p={3}
                                spacing={3}
                                w="240px"
                            >
                                <Text
                                    color="var(--fg-300)"
                                    fontSize="xs"
                                    fontWeight="bold"
                                    textTransform="uppercase"
                                >
                                    Detalhes
                                </Text>
                                {!primarySelectedEntry ? (
                                    <Text
                                        color="var(--fg-300)"
                                        fontSize="xs"
                                    >
                                        Selecione um arquivo ou pasta para visualizar detalhes ou
                                        baixar.
                                    </Text>
                                ) : (
                                    <>
                                        {primarySelectedEntry.isImage && (
                                            <Box
                                                bg="blackAlpha.500"
                                                borderRadius="md"
                                                overflow="hidden"
                                                p={1}
                                            >
                                                <Image
                                                    alt={primarySelectedEntry.name}
                                                    maxH="180px"
                                                    mx="auto"
                                                    objectFit="contain"
                                                    src={getWebFileUrl(primarySelectedEntry.path)}
                                                />
                                            </Box>
                                        )}
                                        <Box>
                                            <Text
                                                fontSize="sm"
                                                fontWeight="semibold"
                                                wordBreak="break-word"
                                            >
                                                {primarySelectedEntry.name}
                                            </Text>
                                            <Text
                                                color="var(--fg-300)"
                                                fontSize="xs"
                                                mt={1}
                                            >
                                                {primarySelectedEntry.isDir
                                                    ? 'Diretório'
                                                    : `${formatFileSize(
                                                          primarySelectedEntry.size
                                                      )} · ${formatDate(
                                                          primarySelectedEntry.modifiedMs
                                                      )}`}
                                            </Text>
                                            <Text
                                                color="var(--fg-300)"
                                                fontFamily="mono"
                                                fontSize="11px"
                                                mt={2}
                                                wordBreak="break-all"
                                            >
                                                {primarySelectedEntry.path}
                                            </Text>
                                        </Box>
                                        {!primarySelectedEntry.isDir && (
                                            <HStack spacing={2}>
                                                <Button
                                                    as="a"
                                                    flex={1}
                                                    href={getWebFileUrl(
                                                        primarySelectedEntry.path,
                                                        true
                                                    )}
                                                    leftIcon={<MdDownload />}
                                                    size="xs"
                                                    variant="outline"
                                                >
                                                    Baixar
                                                </Button>
                                                {primarySelectedEntry.isImage && (
                                                    <Tooltip label="Abrir imagem em nova aba">
                                                        <IconButton
                                                            aria-label="Abrir em nova aba"
                                                            as="a"
                                                            href={getWebFileUrl(
                                                                primarySelectedEntry.path
                                                            )}
                                                            icon={<MdOpenInNew />}
                                                            rel="noopener noreferrer"
                                                            size="xs"
                                                            target="_blank"
                                                            variant="outline"
                                                        />
                                                    </Tooltip>
                                                )}
                                            </HStack>
                                        )}
                                    </>
                                )}
                            </VStack>
                        </Flex>
                    </ModalBody>

                    <ModalFooter
                        borderTopColor="var(--bg-700)"
                        borderTopWidth="1px"
                        justifyContent="space-between"
                        py={3}
                    >
                        <Text
                            isTruncated
                            color="var(--fg-300)"
                            fontFamily="mono"
                            fontSize="xs"
                            maxW="65%"
                            title={listing?.currentPath}
                        >
                            {listing?.currentPath ?? ''}
                        </Text>
                        <HStack spacing={2}>
                            {mode !== 'browse' && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleCancel}
                                >
                                    Cancelar
                                </Button>
                            )}
                            <Button
                                colorScheme="blue"
                                isDisabled={!canConfirm}
                                size="sm"
                                onClick={handleConfirm}
                            >
                                {mode === 'browse' && 'Fechar'}
                                {mode === 'directory' &&
                                    (primarySelectedEntry?.isDir
                                        ? `Usar "${primarySelectedEntry.name}"`
                                        : 'Usar pasta atual')}
                                {mode === 'file' &&
                                    (selectedPaths.length > 1
                                        ? `Selecionar (${selectedPaths.length})`
                                        : 'Selecionar arquivo')}
                            </Button>
                        </HStack>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        );
    }
);
