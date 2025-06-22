import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import noble, { Peripheral } from '@stoprocent/noble';
import { hslToRgb, rgbToHsl, RgbColor } from './rgbConversion';
import { BulbConfig, LedsStatus, validateBulbConfig } from './types';
import { DEFAULT_HANDLE, BLE_COMMANDS, DEFAULT_ACCESSORY_INFO } from './constants';

interface MagicBlueBulbPlatform {
    readonly log: {
        info(message: string, ...parameters: unknown[]): void;
        warn(message: string, ...parameters: unknown[]): void;
        error(message: string, ...parameters: unknown[]): void;
        debug(message: string, ...parameters: unknown[]): void;
    };
    readonly Service: typeof Service;
    readonly Characteristic: typeof import('homebridge').Characteristic;
}

/**
 * Magic Blue Bulb Accessory
 *
 * This class represents a single Magic Blue LED bulb accessory.
 * It handles all the BLE communication and HomeKit characteristic management for one bulb.
 */
export class MagicBlueBulbAccessory {
    private service!: Service;
    private ledsStatus: LedsStatus;
    private readonly mac: string;
    private readonly handle: number;
    private peripheral?: Peripheral;

    constructor(private readonly platform: MagicBlueBulbPlatform, private readonly accessory: PlatformAccessory) {
        let bulb: BulbConfig;
        try {
            bulb = validateBulbConfig(this.accessory.context.bulb);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.platform.log.error(`Invalid bulb configuration for ${this.accessory.displayName}: ${errorMessage}`);
            throw error;
        }

        this.ledsStatus = {
            on: true,
            values: rgbToHsl(255, 255, 255),
        };
        this.mac = bulb.mac.toLowerCase();
        this.handle = bulb.handle || DEFAULT_HANDLE;

        this.setupAccessoryInformation(bulb);
        this.setupLightbulbService(bulb);

        // Initialize BLE discovery asynchronously
        this.findBulb(this.mac).catch((error) => {
            this.platform.log.error(`Failed to initialize BLE discovery for ${bulb.name}:`, error);
        });
    }

    /**
     * Set up accessory information service
     */
    private setupAccessoryInformation(bulb: BulbConfig): void {
        const accessoryInfo = this.accessory.getService(this.platform.Service.AccessoryInformation);
        if (!accessoryInfo) {
            this.platform.log.error('AccessoryInformation service not available');
            return;
        }

        accessoryInfo
            .setCharacteristic(
                this.platform.Characteristic.Manufacturer,
                bulb.manufacturer || DEFAULT_ACCESSORY_INFO.MANUFACTURER,
            )
            .setCharacteristic(this.platform.Characteristic.Model, bulb.model || DEFAULT_ACCESSORY_INFO.MODEL)
            .setCharacteristic(this.platform.Characteristic.SerialNumber, bulb.serial || DEFAULT_ACCESSORY_INFO.SERIAL);
    }

    /**
     * Set up lightbulb service and characteristic handlers
     */
    private setupLightbulbService(bulb: BulbConfig): void {
        this.service =
            this.accessory.getService(this.platform.Service.Lightbulb) ||
            this.accessory.addService(this.platform.Service.Lightbulb);

        this.service.setCharacteristic(this.platform.Characteristic.Name, bulb.name);

        this.service
            .getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.setOn.bind(this))
            .onGet(this.getOn.bind(this));

        this.service
            .getCharacteristic(this.platform.Characteristic.Hue)
            .onSet(this.setHue.bind(this))
            .onGet(this.getHue.bind(this));

        this.service
            .getCharacteristic(this.platform.Characteristic.Saturation)
            .onSet(this.setSaturation.bind(this))
            .onGet(this.getSaturation.bind(this));

        this.service
            .getCharacteristic(this.platform.Characteristic.Brightness)
            .onSet(this.setBrightness.bind(this))
            .onGet(this.getBrightness.bind(this));
    }

    /**
     * Discover and connect to the Magic Blue bulb via Bluetooth LE
     */
    private async findBulb(mac: string, callback?: () => void): Promise<void> {
        try {
            // Wait for Bluetooth adapter to be powered on
            await noble.waitForPoweredOnAsync();

            // Start scanning for devices
            await noble.startScanningAsync();

            // Set up discovery handler
            noble.on('discover', (peripheral: Peripheral) => {
                if (peripheral.id === mac || peripheral.address === mac) {
                    this.platform.log.info('Found Magic Blue bulb:', mac);
                    this.peripheral = peripheral;
                    noble.stopScanningAsync().catch(console.error); // Stop scanning once found
                    if (callback) {
                        callback();
                    }
                }
            });
        } catch (error) {
            this.platform.log.error('Error during BLE discovery:', error);
        }
    }

    /**
     * Write color data to the bulb via BLE
     */
    private async writeColor(callback: () => void): Promise<void> {
        const temp = async (res: boolean): Promise<void> => {
            if (!res) {
                return;
            }
            const rgb: RgbColor = hslToRgb(
                this.ledsStatus.values[0],
                this.ledsStatus.values[1],
                this.ledsStatus.values[2],
            );

            const colorCommand = Buffer.from([
                ...BLE_COMMANDS.COLOR_COMMAND_PREFIX,
                rgb.r,
                rgb.g,
                rgb.b,
                ...BLE_COMMANDS.COLOR_COMMAND_SUFFIX,
            ]);

            if (!this.peripheral) {
                this.platform.log.error('No peripheral available for color write');
                callback();
                return;
            }

            try {
                await this.peripheral.writeHandleAsync(this.handle, colorCommand, true);
                callback();
            } catch (error) {
                this.platform.log.error('BLE: Write handle Error:', error);
                callback();
            }
        };
        await this.attemptConnect(temp);
    }

    /**
     * Attempt to connect to the BLE peripheral
     */
    private async attemptConnect(callback: (success: boolean) => void): Promise<void> {
        if (this.peripheral && this.peripheral.state === 'connected') {
            callback(true);
        } else if (this.peripheral && this.peripheral.state === 'disconnected') {
            this.platform.log.info('Lost connection to bulb. Attempting reconnect...');
            try {
                await this.peripheral.connectAsync();
                this.platform.log.info('Reconnect was successful');
                callback(true);
            } catch (error) {
                this.platform.log.error('Reconnect was unsuccessful:', error);
                callback(false);
            }
        } else {
            this.platform.log.warn('Bulb not found or not ready for connection');
            callback(false);
        }
    }

    /**
     * Handle setting the On characteristic
     */
    async setOn(value: CharacteristicValue): Promise<void> {
        const boolValue = value as boolean;
        const code = boolValue ? BLE_COMMANDS.TURN_ON : BLE_COMMANDS.TURN_OFF;

        return new Promise((resolve, reject) => {
            const temp = async (res: boolean): Promise<void> => {
                if (!this.peripheral || !res) {
                    reject(new Error('Could not connect to peripheral'));
                    return;
                }

                const powerCommand = Buffer.from([
                    ...BLE_COMMANDS.POWER_COMMAND_PREFIX,
                    code,
                    ...BLE_COMMANDS.POWER_COMMAND_SUFFIX,
                ]);

                try {
                    await this.peripheral.writeHandleAsync(this.handle, powerCommand, true);
                    this.ledsStatus.on = boolValue;
                    this.platform.log.debug('Set Characteristic On ->', boolValue);
                    resolve();
                } catch (error) {
                    this.platform.log.error('BLE: Write handle Error:', error);
                    reject(new Error(error instanceof Error ? error.message : String(error)));
                }
            };
            this.attemptConnect(temp).catch(reject);
        });
    }

    /**
     * Handle getting the On characteristic
     */
    async getOn(): Promise<CharacteristicValue> {
        this.platform.log.debug('Get Characteristic On ->', this.ledsStatus.on);
        return this.ledsStatus.on;
    }

    /**
     * Handle setting the Hue characteristic
     */
    async setHue(value: CharacteristicValue): Promise<void> {
        const numValue = value as number;
        return new Promise((resolve) => {
            this.ledsStatus.values[0] = numValue;
            this.platform.log.debug('Set Characteristic Hue ->', numValue);

            if (this.ledsStatus.on) {
                this.writeColor(() => {
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Handle getting the Hue characteristic
     */
    async getHue(): Promise<CharacteristicValue> {
        const hue = this.ledsStatus.values[0];
        this.platform.log.debug('Get Characteristic Hue ->', hue);
        return hue;
    }

    /**
     * Handle setting the Saturation characteristic
     */
    async setSaturation(value: CharacteristicValue): Promise<void> {
        const numValue = value as number;
        return new Promise((resolve) => {
            this.ledsStatus.values[1] = numValue;
            this.platform.log.debug('Set Characteristic Saturation ->', numValue);

            if (this.ledsStatus.on) {
                this.writeColor(() => {
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Handle getting the Saturation characteristic
     */
    async getSaturation(): Promise<CharacteristicValue> {
        const saturation = this.ledsStatus.values[1];
        this.platform.log.debug('Get Characteristic Saturation ->', saturation);
        return saturation;
    }

    /**
     * Handle setting the Brightness characteristic
     */
    async setBrightness(value: CharacteristicValue): Promise<void> {
        const numValue = value as number;
        return new Promise((resolve) => {
            this.ledsStatus.values[2] = numValue;
            this.platform.log.debug('Set Characteristic Brightness ->', numValue);

            if (this.ledsStatus.on) {
                this.writeColor(() => {
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Handle getting the Brightness characteristic
     */
    async getBrightness(): Promise<CharacteristicValue> {
        const brightness = this.ledsStatus.values[2];
        this.platform.log.debug('Get Characteristic Brightness ->', brightness);
        return brightness;
    }
}
