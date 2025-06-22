export const PLATFORM_NAME = 'MagicBlueBulbPlatform';
export const PLUGIN_NAME = 'homebridge-magic-blue-bulb';

export const DEFAULT_HANDLE = 0x000c; // v9 is 0x000b
export const DEFAULT_HANDLE_V9 = 0x000b;

export const BLE_COMMANDS = {
    TURN_ON: 0x23,
    TURN_OFF: 0x24,
    COLOR_COMMAND_PREFIX: [0x56],
    COLOR_COMMAND_SUFFIX: [0x00, 0xf0, 0xaa, 0x3b, 0x07, 0x00, 0x01],
    POWER_COMMAND_PREFIX: [0xcc],
    POWER_COMMAND_SUFFIX: [0x33],
} as const;

export const DEFAULT_ACCESSORY_INFO = {
    MANUFACTURER: 'Light',
    MODEL: 'Magic Blue',
    SERIAL: '5D4989E80E44',
} as const;
