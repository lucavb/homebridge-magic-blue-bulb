/* 

Thanks to Garry Tan for the conversion methods.
http://axonflux.com/handy-rgb-to-hsl-and-rgb-to-hsv-color-model-c

*/


/**
 * Converts an HSV color value to RGB. Conversion formula
 * adapted from http://stackoverflow.com/a/17243070/2061684
 * Assumes h in [0..360], and s and l in [0..100] and
 * returns r, g, and b in [0..255].
 *
 * @param   {Number}  h       The hue
 * @param   {Number}  s       The saturation
 * @param   {Number}  l       The lightness
 * @return  {Array}           The RGB representation
 */
module.exports.hslToRgb =function(h, s, v) {
    var r, g, b, i, f, p, q, t;

    h /= 360;
    s /= 100;
    v /= 100;

    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    var rgb = { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
    return rgb;
};

/**
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are in [0..255] and
 * returns h in [0..360], and s and l in [0..100].
 *
 * @param   {Number}  r       The red color value
 * @param   {Number}  g       The green color value
 * @param   {Number}  b       The blue color value
 * @return  {Array}           The HSL representation
 */
module.exports.rgbToHsl = function(r, g, b){
    r /= 255;
    g /= 255;
    b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if(max == min){
        h = s = 0; // achromatic
    }else{
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max){
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    h *= 360; // return degrees [0..360]
    s *= 100; // return percent [0..100]
    l *= 100; // return percent [0..100]
    return [parseInt(h), parseInt(s), parseInt(l)];
};