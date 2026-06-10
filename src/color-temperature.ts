/** HomeKit ColorTemperature range (mireds) for tunable-white lights */
export const MIRED_MIN = 140;
export const MIRED_MAX = 500;

/** Above this mired value the bulb warm-white channel is used instead of RGB white */
export const WARM_WHITE_MIRED_THRESHOLD = 300;

export function isWarmWhiteMireds(mireds: number): boolean {
    return mireds >= WARM_WHITE_MIRED_THRESHOLD;
}

/** Map HomeKit brightness (0–100) and mireds to warm-white channel intensity (0–255) */
export function brightnessAndMiredsToWarmWhiteIntensity(brightness: number, mireds: number): number {
    const clampedMireds = Math.max(WARM_WHITE_MIRED_THRESHOLD, Math.min(MIRED_MAX, mireds));
    const warmth = (clampedMireds - WARM_WHITE_MIRED_THRESHOLD) / (MIRED_MAX - WARM_WHITE_MIRED_THRESHOLD);
    return Math.round((brightness / 100) * 255 * warmth);
}

/** Derive a representative mired value from warm-white intensity and brightness */
export function warmWhiteIntensityToMireds(intensity: number, brightness: number): number {
    if (brightness <= 0 || intensity <= 0) {
        return MIRED_MAX;
    }
    const warmth = intensity / 255 / (brightness / 100);
    const mireds = WARM_WHITE_MIRED_THRESHOLD + warmth * (MIRED_MAX - WARM_WHITE_MIRED_THRESHOLD);
    return Math.round(Math.max(WARM_WHITE_MIRED_THRESHOLD, Math.min(MIRED_MAX, mireds)));
}
