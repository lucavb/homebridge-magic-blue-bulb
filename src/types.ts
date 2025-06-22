import { z } from 'zod';

export const ledsStatusSchema = z.object({
    on: z.boolean(),
    values: z
        .object({
            hue: z.number(),
            saturation: z.number(),
            lightness: z.number(),
        })
        .describe('HSL values'),
});

export type LedsStatus = z.infer<typeof ledsStatusSchema>;

export const bulbConfigSchema = z.object({
    name: z.string().min(1, 'Bulb name is required'),
    mac: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, 'Invalid MAC address format'),
    handle: z.number().int().min(1).optional(),
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
        const errorMessages = result.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
        throw new Error(`Invalid bulb configuration: ${errorMessages}`);
    }
    return result.data;
}

export function validatePlatformConfig(input: unknown): PlatformConfigType {
    const result = platformConfigSchema.safeParse(input);
    if (!result.success) {
        const errorMessages = result.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
        throw new Error(`Invalid platform configuration: ${errorMessages}`);
    }
    return result.data;
}
