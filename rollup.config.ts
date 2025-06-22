import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import { dts } from 'rollup-plugin-dts';

export default defineConfig([
    {
        input: 'src/index.ts',
        output: {
            file: 'dist/esm/index.mjs',
            format: 'esm',
            sourcemap: true,
        },
        plugins: [
            typescript({
                tsconfig: './tsconfig.build.json',
                declaration: false, // We handle types separately
            }),
        ],
        external: ['homebridge', '@stoprocent/noble', 'zod'],
    },
    {
        input: 'src/index.ts',
        output: {
            file: 'dist/cjs/index.cjs',
            format: 'cjs',
            sourcemap: true,
            exports: 'auto',
        },
        plugins: [
            typescript({
                tsconfig: './tsconfig.build.json',
                declaration: false, // We handle types separately
            }),
        ],
        external: ['homebridge', '@stoprocent/noble', 'zod'],
    },
    {
        input: 'src/index.ts',
        output: {
            file: 'dist/types/index.d.ts',
            format: 'esm',
        },
        plugins: [dts()],
        external: ['homebridge', '@stoprocent/noble', 'zod'],
    },
]);
