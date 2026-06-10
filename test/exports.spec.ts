import { describe, expect, it } from 'vitest';
import cjsPlugin from '../dist/index.cjs';

describe('dist exports', () => {
    it('exposes CJS default export', () => {
        expect(typeof cjsPlugin).toBe('function');
    });

    it('exposes ESM default export', async () => {
        const module = await import('../dist/index.mjs');
        expect(typeof module.default).toBe('function');
    });
});
