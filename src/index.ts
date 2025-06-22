import { API, Logger, AccessoryPlugin, AccessoryConfig } from 'homebridge';
import * as noble from 'noble';
import { Peripheral } from 'noble';
import { hslToRgb, rgbToHsl, RgbColor } from './rgbConversion';

let Service: any;
let Characteristic: any;
let HomebridgeAPI: API;

export = (api: API) => {
    Service = api.hap.Service;
    Characteristic = api.hap.Characteristic;
    HomebridgeAPI = api;

    api.registerAccessory('homebridge-magic-blue-bulb', 'magic-blue-bulb', MagicBlueBulb);
};

interface MagicBlueBulbConfig {
    name: string;
    mac: string;
    handle?: number;
    manufacturer?: string;
    model?: string;
    serial?: string;
}

interface LedsStatus {
    on: boolean;
    values: [number, number, number]; // HSL values
}

class MagicBlueBulb implements AccessoryPlugin {
    private readonly log: Logger;
    private readonly name: string;
    private ledsStatus: LedsStatus;
    private readonly mac: string;
    private readonly handle: number;
    private peripheral?: Peripheral;
    private readonly informationService: any;
    private readonly service: any;

    constructor(log: Logger, config: any) {
        this.log = log;
        this.name = config.name;
        this.ledsStatus = {
            on: true,
            values: rgbToHsl(255, 255, 255),
        };
        this.mac = config.mac.toLowerCase();
        this.handle = config.handle || 0x000c; // v9 is 0x000b

        this.findBulb(this.mac);

        // info service
        this.informationService = new Service.AccessoryInformation();

        this.informationService
            .setCharacteristic(Characteristic.Manufacturer, config.manufacturer || 'Light')
            .setCharacteristic(Characteristic.Model, config.model || 'Magic Blue')
            .setCharacteristic(Characteristic.SerialNumber, config.serial || '5D4989E80E44');

        this.service = new Service.Lightbulb(this.name);

        this.service.getCharacteristic(Characteristic.On).on('get', this.getState.bind(this));
        this.service.getCharacteristic(Characteristic.On).on('set', this.setState.bind(this));

        this.service.getCharacteristic(Characteristic.Hue).on('get', this.getHue.bind(this));
        this.service.getCharacteristic(Characteristic.Hue).on('set', this.setHue.bind(this));

        this.service.getCharacteristic(Characteristic.Saturation).on('get', this.getSat.bind(this));
        this.service.getCharacteristic(Characteristic.Saturation).on('set', this.setSat.bind(this));

        this.service.getCharacteristic(Characteristic.Brightness).on('get', this.getBright.bind(this));
        this.service.getCharacteristic(Characteristic.Brightness).on('set', this.setBright.bind(this));
    }

    private findBulb(mac: string, callback?: () => void): void {
        noble.on('stateChange', (state: string) => {
            if (state === 'poweredOn') {
                noble.startScanning();
            } else {
                noble.stopScanning();
            }
        });

        noble.on('discover', (peripheral: Peripheral) => {
            if (peripheral.id === mac || peripheral.address === mac) {
                this.log.info('found my bulb');
                this.peripheral = peripheral;
                if (callback) {
                    callback();
                }
            }
        });
    }

    private writeColor(callback: () => void): void {
        const temp = (res: boolean): void => {
            if (!res) {
                // callback(new Error());
                return;
            }
            const rgb: RgbColor = hslToRgb(
                this.ledsStatus.values[0],
                this.ledsStatus.values[1],
                this.ledsStatus.values[2],
            );
            this.peripheral!.writeHandle(
                this.handle,
                Buffer.from([0x56, rgb.r, rgb.g, rgb.b, 0x00, 0xf0, 0xaa, 0x3b, 0x07, 0x00, 0x01]),
                true,
                (error?: string | null) => {
                    if (error) {
                        this.log.error('BLE: Write handle Error: ' + error);
                    }
                    callback();
                },
            );
        };
        this.attemptConnect(temp);
    }

    private attemptConnect(callback: (success: boolean) => void): void {
        if (this.peripheral && this.peripheral.state === 'connected') {
            callback(true);
        } else if (this.peripheral && this.peripheral.state === 'disconnected') {
            this.log.info('lost connection to bulb. attempting reconnect ...');
            this.peripheral.connect((error?: string | null) => {
                if (!error) {
                    this.log.info('reconnect was successful');
                    callback(true);
                } else {
                    this.log.error('reconnect was unsuccessful');
                    callback(false);
                }
            });
        }
    }

    private setState(status: boolean, callback: (error?: Error | null) => void): void {
        const code = status ? 0x23 : 0x24;
        const temp = (res: boolean): void => {
            if (!this.peripheral || !res) {
                callback(new Error('Could not connect to peripheral'));
                return;
            }
            this.peripheral.writeHandle(this.handle, Buffer.from([0xcc, code, 0x33]), true, (error?: string | null) => {
                if (error) {
                    this.log.error('BLE: Write handle Error: ' + error);
                }
                callback();
            });
        };
        this.attemptConnect(temp);
        this.ledsStatus.on = status;
    }

    private getState(callback: (error: Error | null, value?: boolean) => void): void {
        callback(null, this.ledsStatus.on);
    }

    private getHue(callback: (error: Error | null, value?: number) => void): void {
        callback(null, this.ledsStatus.values[0]);
    }

    private setHue(level: number, callback: (error?: Error | null) => void): void {
        this.ledsStatus.values[0] = level;
        if (this.ledsStatus.on) {
            this.writeColor(() => {
                callback();
            });
        } else {
            callback();
        }
    }

    private getSat(callback: (error: Error | null, value?: number) => void): void {
        callback(null, this.ledsStatus.values[1]);
    }

    private setSat(level: number, callback: (error?: Error | null) => void): void {
        this.ledsStatus.values[1] = level;
        if (this.ledsStatus.on) {
            this.writeColor(() => {
                callback();
            });
        } else {
            callback();
        }
    }

    private getBright(callback: (error: Error | null, value?: number) => void): void {
        callback(null, this.ledsStatus.values[2]);
    }

    private setBright(level: number, callback: (error?: Error | null) => void): void {
        this.ledsStatus.values[2] = level;
        if (this.ledsStatus.on) {
            this.writeColor(() => {
                callback();
            });
        } else {
            callback();
        }
    }

    getServices(): any[] {
        return [this.informationService, this.service];
    }
}
