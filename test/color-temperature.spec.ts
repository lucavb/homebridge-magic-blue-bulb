import { describe, expect, it } from 'vitest';
import {
    brightnessAndMiredsToWarmWhiteIntensity,
    isWarmWhiteMireds,
    warmWhiteIntensityToMireds,
    WARM_WHITE_MIRED_THRESHOLD,
    MIRED_MAX,
} from '../src/color-temperature.js';

describe('colorTemperature', () => {
    it('isWarmWhiteMireds uses threshold', () => {
        expect(isWarmWhiteMireds(WARM_WHITE_MIRED_THRESHOLD)).toBe(true);
        expect(isWarmWhiteMireds(WARM_WHITE_MIRED_THRESHOLD - 1)).toBe(false);
    });

    it('brightnessAndMiredsToWarmWhiteIntensity scales with warmth', () => {
        const warm = brightnessAndMiredsToWarmWhiteIntensity(100, MIRED_MAX);
        const lessWarm = brightnessAndMiredsToWarmWhiteIntensity(100, WARM_WHITE_MIRED_THRESHOLD);
        expect(warm).toBeGreaterThan(lessWarm);
        expect(warm).toBe(255);
        expect(lessWarm).toBe(0);
    });

    it('warmWhiteIntensityToMireds round-trips approximately', () => {
        const mireds = warmWhiteIntensityToMireds(200, 80);
        expect(mireds).toBeGreaterThanOrEqual(WARM_WHITE_MIRED_THRESHOLD);
        expect(mireds).toBeLessThanOrEqual(MIRED_MAX);
    });
});
