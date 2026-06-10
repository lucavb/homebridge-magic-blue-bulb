import { z } from 'zod';
import { MIRED_MAX, MIRED_MIN } from './color-temperature';

export const lightModeSchema = z.enum(['rgb', 'warmWhite']);

export const ledsStatusSchema = z.object({
    on: z.boolean(),
    mode: lightModeSchema,
    values: z
        .object({
            hue: z.number(),
            saturation: z.number(),
            lightness: z.number(),
        })
        .describe('HSL values'),
    colorTemperature: z.number().min(MIRED_MIN).max(MIRED_MAX),
});

export type LightMode = z.infer<typeof lightModeSchema>;
export type LedsStatus = z.infer<typeof ledsStatusSchema>;

export const bulbConfigSchema = z.object({
    name: z.string().min(1, 'Bulb name is required'),
    mac: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, 'Invalid MAC address format'),
    handle: z.number().int().min(1).optional(),
    readHandle: z.number().int().min(1).optional(),
    version: z.union([z.literal(6), z.literal(7), z.literal(8), z.literal(9), z.literal(10)]).optional(),
    addressType: z.enum(['public', 'random']).optional(),
    debug: z.boolean().optional(),
    manufacturer: z.string().optional(),
    model: z.string().optional(),
    serial: z.string().optional(),
});

export type BulbConfig = z.infer<typeof bulbConfigSchema>;

export const platformConfigSchema = z.object({
    name: z.string().min(1, 'Platform name is required'),
    platform: z.literal('MagicBlueBulbPlatform'),
    bulbs: z.array(bulbConfigSchema).min(1, 'At least one bulb configuration is required'),
});

export type PlatformConfigType = z.infer<typeof platformConfigSchema>;

export function validateBulbConfig(input: unknown): BulbConfig {
    const result = bulbConfigSchema.safeParse(input);
    if (!result.success) {
        const errorMessages = result.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
        throw new Error(`Invalid bulb configuration: ${errorMessages}`);
    }
    return result.data;
}

export function validatePlatformConfig(input: unknown): PlatformConfigType {
    const result = platformConfigSchema.safeParse(input);
    if (!result.success) {
        const errorMessages = result.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
        throw new Error(`Invalid platform configuration: ${errorMessages}`);
    }
    return result.data;
}
