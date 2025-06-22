import { z } from 'zod';

/**
 * LED status schema and type representing the current state of the bulb
 */
export const LedsStatusSchema = z.object({
    on: z.boolean(),
    values: z.tuple([z.number(), z.number(), z.number()]).describe('HSL values: [hue, saturation, lightness]'),
});

export type LedsStatus = z.infer<typeof LedsStatusSchema>;

/**
 * Configuration schema and type for individual bulb settings
 */
export const BulbConfigSchema = z.object({
    name: z.string().min(1, 'Bulb name is required'),
    mac: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, 'Invalid MAC address format'),
    handle: z.number().int().min(1).optional(),
    manufacturer: z.string().optional(),
    model: z.string().optional(),
    serial: z.string().optional(),
});

export type BulbConfig = z.infer<typeof BulbConfigSchema>;

/**
 * Platform configuration schema for the entire platform
 */
export const PlatformConfigSchema = z.object({
    name: z.string().min(1, 'Platform name is required'),
    platform: z.literal('MagicBlueBulbPlatform'),
    bulbs: z.array(BulbConfigSchema).min(1, 'At least one bulb configuration is required'),
});

export type PlatformConfigType = z.infer<typeof PlatformConfigSchema>;

/**
 * Validation function for bulb configuration
 */
export function validateBulbConfig(input: unknown): BulbConfig {
    try {
        return BulbConfigSchema.parse(input);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
            throw new Error(`Invalid bulb configuration: ${errorMessages}`);
        }
        throw error;
    }
}

/**
 * Validation function for platform configuration
 */
export function validatePlatformConfig(input: unknown): PlatformConfigType {
    try {
        return PlatformConfigSchema.parse(input);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
            throw new Error(`Invalid platform configuration: ${errorMessages}`);
        }
        throw error;
    }
}
