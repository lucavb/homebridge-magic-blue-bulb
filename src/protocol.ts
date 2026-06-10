/**
 * Magic Blue BLE protocol — ported from Betree/magicblue magicbluelib.Protocol
 * and cross-checked against yeemachine/magicblue DICT constants.
 */

export const POWER_ON_BYTE = 0x23;
export const POWER_OFF_BYTE = 0x24;
export const STATUS_HEADER = 0x66;
export const STATUS_FOOTER = 0x99;

export interface ParsedDeviceStatus {
    on: boolean;
    mode: 'rgb' | 'warmWhite';
    red: number;
    green: number;
    blue: number;
    warmWhiteIntensity: number;
}

/** ported from Protocol.encode_turn_on */
export function buildPowerOnCommand(): Buffer {
    return Buffer.from([0xcc, POWER_ON_BYTE, 0x33]);
}

/** ported from Protocol.encode_turn_off */
export function buildPowerOffCommand(): Buffer {
    return Buffer.from([0xcc, POWER_OFF_BYTE, 0x33]);
}

/** ported from Protocol.encode_set_rgb — uses extended suffix for backward compatibility */
export function buildRgbCommand(red: number, green: number, blue: number): Buffer {
    return Buffer.from([0x56, red, green, blue, 0x00, 0xf0, 0xaa, 0x3b, 0x07, 0x00, 0x01]);
}

/** ported from Protocol.encode_set_brightness (warm white channel) */
export function buildWarmWhiteCommand(intensity: number): Buffer {
    const clamped = Math.max(0, Math.min(255, Math.round(intensity)));
    return Buffer.from([0x56, 0x00, 0x00, 0x00, clamped, 0x0f, 0xaa]);
}

/** ported from Protocol.encode_request_device_info */
export function buildStatusRequestCommand(): Buffer {
    return Buffer.from([0xef, 0x01, 0x77]);
}

/**
 * ported from Protocol.decode_device_info + yeemachine decodeStatus white/rgb mode detection
 */
export function parseDeviceStatus(buffer: Buffer): ParsedDeviceStatus | null {
    if (buffer.length < 12 || buffer[0] !== STATUS_HEADER || buffer[11] !== STATUS_FOOTER) {
        return null;
    }

    const red = buffer[6] ?? 0;
    const green = buffer[7] ?? 0;
    const blue = buffer[8] ?? 0;
    const warmWhiteIntensity = buffer[9] ?? 0;
    const isWarmWhite = warmWhiteIntensity > 0 && red === 0 && green === 0 && blue === 0;

    return {
        on: (buffer[2] ?? 0) === POWER_ON_BYTE,
        mode: isWarmWhite ? 'warmWhite' : 'rgb',
        red,
        green,
        blue,
        warmWhiteIntensity,
    };
}

export type BleAddressType = 'public' | 'random';

/** ported from magicbluelib._figure_addr_type */
export function resolveAddressType(
    version?: number,
    addressType?: BleAddressType,
    macAddress?: string,
): BleAddressType {
    if (addressType) {
        return addressType;
    }

    if (version === 6 || version === 9 || version === 10) {
        return 'public';
    }

    if (version === 7 || version === 8) {
        return 'random';
    }

    if (macAddress) {
        const macNum = Number.parseInt(macAddress.replace(/[:-]/g, ''), 16);
        if ((macNum & 0xf00000000000) === 0xf00000000000) {
            return 'public';
        }
    }

    return 'random';
}
