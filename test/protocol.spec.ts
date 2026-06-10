import { describe, expect, it } from 'vitest';
import {
    buildPowerOnCommand,
    buildPowerOffCommand,
    buildRgbCommand,
    buildWarmWhiteCommand,
    buildStatusRequestCommand,
    parseDeviceStatus,
    resolveAddressType,
    POWER_ON_BYTE,
} from '../src/protocol.js';

describe('protocol', () => {
    it('buildPowerOnCommand matches Betree encode_turn_on', () => {
        expect([...buildPowerOnCommand()]).toEqual([0xcc, 0x23, 0x33]);
    });

    it('buildPowerOffCommand matches Betree encode_turn_off', () => {
        expect([...buildPowerOffCommand()]).toEqual([0xcc, 0x24, 0x33]);
    });

    it('buildRgbCommand uses extended suffix for backward compatibility', () => {
        expect([...buildRgbCommand(255, 128, 0)]).toEqual([
            0x56, 255, 128, 0, 0x00, 0xf0, 0xaa, 0x3b, 0x07, 0x00, 0x01,
        ]);
    });

    it('buildWarmWhiteCommand matches Betree encode_set_brightness', () => {
        expect([...buildWarmWhiteCommand(200)]).toEqual([0x56, 0x00, 0x00, 0x00, 200, 0x0f, 0xaa]);
    });

    it('buildStatusRequestCommand matches wiki EF0177', () => {
        expect([...buildStatusRequestCommand()]).toEqual([0xef, 0x01, 0x77]);
    });

    it('parseDeviceStatus decodes wiki example payload', () => {
        const buffer = Buffer.from([0x66, 0x15, POWER_ON_BYTE, 0x25, 0x41, 0x1f, 0x48, 0xff, 0x00, 0x00, 0x07, 0x99]);
        const status = parseDeviceStatus(buffer);
        expect(status).not.toBeNull();
        expect(status?.on).toBe(true);
        expect(status?.mode).toBe('rgb');
        expect(status?.red).toBe(0x48);
        expect(status?.green).toBe(0xff);
        expect(status?.blue).toBe(0x00);
    });

    it('parseDeviceStatus detects warm white mode', () => {
        const buffer = Buffer.from([0x66, 0x15, POWER_ON_BYTE, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 180, 0x07, 0x99]);
        const status = parseDeviceStatus(buffer);
        expect(status).not.toBeNull();
        expect(status?.mode).toBe('warmWhite');
        expect(status?.warmWhiteIntensity).toBe(180);
    });

    it('resolveAddressType maps bulb versions per Betree', () => {
        expect(resolveAddressType(7)).toBe('random');
        expect(resolveAddressType(9)).toBe('public');
        expect(resolveAddressType(undefined, 'public')).toBe('public');
    });
});
