/**
 * LED status interface representing the current state of the bulb
 */
export interface LedsStatus {
    on: boolean;
    values: [number, number, number]; // HSL values: [hue, saturation, lightness]
}

/**
 * Configuration interface for individual bulb settings
 */
export interface BulbConfig {
    name: string;
    mac: string;
    handle?: number;
    manufacturer?: string;
    model?: string;
    serial?: string;
}
