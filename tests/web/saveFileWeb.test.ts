import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Version } from '../../src/common/common-types';
import { md5Hex, parseSaveFile, stringifySaveFile } from '../../src/web/saveFileWeb';
import type { SaveData } from '../../src/main/SaveFile';

describe('saveFileWeb', () => {
    it('computes the exact same MD5 hex digest as node:crypto', () => {
        const samples = ['', 'abc', 'hello world', '{"nodes":[],"edges":[]}', 'ação com UTF-8 🚀'];
        for (const sample of samples) {
            const expected = createHash('md5').update(sample, 'utf-8').digest('hex');
            expect(md5Hex(sample)).toBe(expected);
        }
    });

    it('round-trips a chain with valid checksum and tamperedWith=false', () => {
        const saveData: SaveData = {
            nodes: [],
            edges: [],
            viewport: { x: 12, y: -34, zoom: 1.25 },
        };

        const serialized = stringifySaveFile(saveData, '0.26.1' as Version);
        const parsed = parseSaveFile(serialized);

        expect(parsed.tamperedWith).toBe(false);
        expect(parsed.nodes).toEqual([]);
        expect(parsed.edges).toEqual([]);
        expect(parsed.viewport).toEqual(saveData.viewport);
    });

    it('flags tamperedWith=true when checksum does not match', () => {
        const saveData: SaveData = {
            nodes: [],
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 },
        };

        const serialized = stringifySaveFile(saveData, '0.26.1' as Version);
        const obj = JSON.parse(serialized) as { checksum: string };
        obj.checksum = '00000000000000000000000000000000';

        const parsed = parseSaveFile(JSON.stringify(obj));
        expect(parsed.tamperedWith).toBe(true);
    });
});
