export const PLATFORM_NAME = 'MagicBlueBulbPlatform';
export const PLUGIN_NAME = 'homebridge-magic-blue-bulb';

export const DEFAULT_HANDLE = 0x000c;
export const DEFAULT_READ_HANDLE = 0x000f;

export const STATUS_POLL_INTERVAL_MS = 30_000;

export const DEFAULT_ACCESSORY_INFO = {
    MANUFACTURER: 'Light',
    MODEL: 'Magic Blue',
    SERIAL: '5D4989E80E44',
} as const;
