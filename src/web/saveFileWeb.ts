/* eslint-disable no-bitwise */
import { EdgeData, NodeData, Version } from '../common/common-types';
import { currentMigration, migrate } from '../common/migrations';
import { versionGt } from '../common/version';
import type { ParsedSaveData, RawSaveFile, SaveData } from '../main/SaveFile';
import type { Edge, Node } from 'reactflow';

const SHIFT_AMOUNTS = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9,
    14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const md5Constants = Array.from({ length: 64 }, (_, i) =>
    Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32)
);

const toHexLE = (word: number): string => {
    let hex = '';
    for (let i = 0; i < 4; i += 1) {
        hex += ((word >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
    }
    return hex;
};

/**
 * Pure-JS RFC 1321 MD5 implementation (UTF-8) so browser `.chn` files produce
 * the exact same checksum as Node's `crypto.createHash('md5')` in `SaveFile.ts`.
 */
export const md5Hex = (input: string): string => {
    const bytes = new TextEncoder().encode(input);
    const bitLen = bytes.length * 8;
    const paddedLen = (((bytes.length + 8) >> 6) + 1) << 6;
    const padded = new Uint8Array(paddedLen);
    padded.set(bytes);
    padded[bytes.length] = 0x80;

    const view = new DataView(padded.buffer);
    view.setUint32(paddedLen - 8, bitLen >>> 0, true);
    view.setUint32(paddedLen - 4, Math.floor(bitLen / 2 ** 32) >>> 0, true);

    let a0 = 0x67452301;
    let b0 = 0xefcdab89;
    let c0 = 0x98badcfe;
    let d0 = 0x10325476;

    const m = new Uint32Array(16);

    for (let offset = 0; offset < paddedLen; offset += 64) {
        for (let j = 0; j < 16; j += 1) {
            m[j] = view.getUint32(offset + j * 4, true);
        }

        let a = a0;
        let b = b0;
        let c = c0;
        let d = d0;

        for (let i = 0; i < 64; i += 1) {
            let f: number;
            let g: number;
            if (i < 16) {
                f = (b & c) | (~b & d);
                g = i;
            } else if (i < 32) {
                f = (d & b) | (~d & c);
                g = (5 * i + 1) % 16;
            } else if (i < 48) {
                f = b ^ c ^ d;
                g = (3 * i + 5) % 16;
            } else {
                f = c ^ (b | ~d);
                g = (7 * i) % 16;
            }

            const sum = (a + f + md5Constants[i] + m[g]) >>> 0;
            const s = SHIFT_AMOUNTS[i];
            const rotated = ((sum << s) | (sum >>> (32 - s))) >>> 0;
            a = d;
            d = c;
            c = b;
            b = (b + rotated) >>> 0;
        }

        a0 = (a0 + a) >>> 0;
        b0 = (b0 + b) >>> 0;
        c0 = (c0 + c) >>> 0;
        d0 = (d0 + d) >>> 0;
    }

    return toHexLE(a0) + toHexLE(b0) + toHexLE(c0) + toHexLE(d0);
};

const decodeBase64Utf8 = (base64: string): string => {
    const binary = atob(base64.trim());
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
};

export const parseSaveFile = (rawValue: string): ParsedSaveData => {
    const value = /^\s*\{/.test(rawValue) ? rawValue : decodeBase64Utf8(rawValue);
    const rawData = JSON.parse(value) as RawSaveFile | (SaveData & { version?: never });

    let data: SaveData;
    let tamperedWith = false;
    if (rawData.version) {
        const { version, content, checksum, migration } = rawData;
        if (checksum !== undefined) {
            tamperedWith = checksum !== md5Hex(JSON.stringify(content));
        } else {
            tamperedWith = versionGt(version, '0.6.1') || (migration ?? 0) > 4;
        }

        data = migrate(version, content, migration) as SaveData;
    } else {
        data = migrate(null, rawData) as SaveData;
    }

    return {
        ...data,
        tamperedWith,
    };
};

export const stringifySaveFile = (content: SaveData, version: Version): string => {
    const { nodes, edges, viewport } = content;

    const sanitizedContent: RawSaveFile['content'] = {
        nodes: nodes.map(
            (n): Node<NodeData> => ({
                data: {
                    schemaId: n.data.schemaId,
                    inputData: n.data.inputData,
                    inputHeight: n.data.inputHeight,
                    outputHeight: n.data.outputHeight,
                    nodeWidth: n.data.nodeWidth,
                    id: n.data.id,
                    isDisabled: n.data.isDisabled,
                    isLocked: n.data.isLocked,
                    isCollapsed: n.data.isCollapsed,
                    isPassthrough: n.data.isPassthrough,
                    nodeName: n.data.nodeName,
                },
                id: n.id,
                position: n.position,
                type: n.type,
                selected: n.selected,
                height: n.height,
                width: n.width,
                zIndex: n.zIndex,
            })
        ),
        edges: edges.map((e): Edge<EdgeData> => ({ ...e, data: {} })),
        viewport,
    };

    const data: Required<RawSaveFile> = {
        version,
        content: sanitizedContent,
        timestamp: new Date().toISOString(),
        checksum: md5Hex(JSON.stringify(sanitizedContent)),
        migration: currentMigration,
    };

    return JSON.stringify(data);
};
