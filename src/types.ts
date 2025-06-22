import { z } from 'zod';

/**
 * LED status schema and type representing the current state of the bulb
 */
export const ledsStatusSchema = z.object({
    on: z.boolean(),
    values: z.tuple([z.number(), z.number(), z.number()]).describe('HSL values: [hue, saturation, lightness]'),
});

export type LedsStatus = z.infer<typeof ledsStatusSchema>;

/**
 * Configuration schema and type for individual bulb settings
 */
export const bulbConfigSchema = z.object({
    name: z.string().min(1, 'Bulb name is required'),
    mac: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, 'Invalid MAC address format'),
    handle: z.number().int().min(1).optional(),
    manufacturer: z.string().optional(),
    model: z.string().optional(),
    serial: z.string().optional(),
});

export type BulbConfig = z.infer<typeof bulbConfigSchema>;

/**
 * Platform configuration schema for the entire platform
 */
export const platformConfigSchema = z.object({
    name: z.string().min(1, 'Platform name is required'),
    platform: z.literal('MagicBlueBulbPlatform'),
    bulbs: z.array(bulbConfigSchema).min(1, 'At least one bulb configuration is required'),
});

export type PlatformConfigType = z.infer<typeof platformConfigSchema>;

/**
 * Validation function for bulb configuration
 */
export function validateBulbConfig(input: unknown): BulbConfig {
    const result = bulbConfigSchema.safeParse(input);
    if (!result.success) {
        const errorMessages = result.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
        throw new Error(`Invalid bulb configuration: ${errorMessages}`);
    }
    return result.data;
}

/**
 * Validation function for platform configuration
 */
export function validatePlatformConfig(input: unknown): PlatformConfigType {
    const result = platformConfigSchema.safeParse(input);
    if (!result.success) {
        const errorMessages = result.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
        throw new Error(`Invalid platform configuration: ${errorMessages}`);
    }
    return result.data;
}
