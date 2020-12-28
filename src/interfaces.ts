import { AccessoryConfig } from 'homebridge';

export interface BulbState {
    on: boolean;
    hue: number;
    saturation: number;
    lightness: number;
}

export interface MagicBlueBulbConfig extends AccessoryConfig {
    mac?: string;
    handle?: number;
    manufacturer?: string;
    model?: string;
    serial?: string;
}

export interface RGB {
    red: number;
    green: number;
    blue: number;
}
