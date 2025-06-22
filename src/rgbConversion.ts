/*

Thanks to Garry Tan for the conversion methods.
http://axonflux.com/handy-rgb-to-hsl-and-rgb-to-hsv-color-model-c

*/

export interface RgbColor {
    r: number;
    g: number;
    b: number;
}

/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from http://stackoverflow.com/a/17243070/2061684
 * Assumes h in [0..360], and s and l in [0..100] and
 * returns r, g, and b in [0..255].
 *
 * @param   {number}  h       The hue
 * @param   {number}  s       The saturation
 * @param   {number}  l       The lightness
 * @return  {RgbColor}        The RGB representation
 */
export function hslToRgb(h: number, s: number, v: number): RgbColor {
    let r = 0,
        g = 0,
        b = 0;

    h /= 360;
    s /= 100;
    v /= 100;

    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0:
            r = v;
            g = t;
            b = p;
            break;
        case 1:
            r = q;
            g = v;
            b = p;
            break;
        case 2:
            r = p;
            g = v;
            b = t;
            break;
        case 3:
            r = p;
            g = q;
            b = v;
            break;
        case 4:
            r = t;
            g = p;
            b = v;
            break;
        case 5:
            r = v;
            g = p;
            b = q;
            break;
    }
    const rgb: RgbColor = {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
    };
    return rgb;
}

/**
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are in [0..255] and
 * returns h in [0..360], and s and l in [0..100].
 *
 * @param   {number}  r       The red color value
 * @param   {number}  g       The green color value
 * @param   {number}  b       The blue color value
 * @return  {number[]}        The HSL representation
 */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h: number;
    let s: number;
    const l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
            default:
                h = 0;
        }
        h /= 6;
    }

    h *= 360;
    s *= 100;
    const lightness = l * 100;
    return [parseInt(h.toString()), parseInt(s.toString()), parseInt(lightness.toString())];
}
