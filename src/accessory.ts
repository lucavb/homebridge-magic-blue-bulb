import { Service, PlatformAccessory, CharacteristicValue, Characteristic, Logger } from 'homebridge';
import noble, { Peripheral } from '@stoprocent/noble';
import { hslToRgb, rgbToHsl, RgbColor } from './rgbConversion';
import { BulbConfig, LedsStatus, validateBulbConfig } from './types';
import { DEFAULT_HANDLE, BLE_COMMANDS, DEFAULT_ACCESSORY_INFO } from './constants';

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

    constructor(
        private readonly log: Logger,
        private readonly homebridgeService: typeof Service,
        private readonly homebridgeCharacteristic: typeof Characteristic,
        private readonly accessory: PlatformAccessory,
    ) {
        let bulb: BulbConfig;
        try {
            bulb = validateBulbConfig(this.accessory.context.bulb);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log.error(`Invalid bulb configuration for ${this.accessory.displayName}: ${errorMessage}`);
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
            this.log.error(`Failed to initialize BLE discovery for ${bulb.name}:`, error);
        });
    }

    /**
     * Set up accessory information service
     */
    private setupAccessoryInformation(bulb: BulbConfig): void {
        const accessoryInfo = this.accessory.getService(this.homebridgeService.AccessoryInformation);
        if (!accessoryInfo) {
            this.log.error('AccessoryInformation service not available');
            return;
        }

        accessoryInfo
            .setCharacteristic(
                this.homebridgeCharacteristic.Manufacturer,
                bulb.manufacturer || DEFAULT_ACCESSORY_INFO.MANUFACTURER,
            )
            .setCharacteristic(this.homebridgeCharacteristic.Model, bulb.model || DEFAULT_ACCESSORY_INFO.MODEL)
            .setCharacteristic(
                this.homebridgeCharacteristic.SerialNumber,
                bulb.serial || DEFAULT_ACCESSORY_INFO.SERIAL,
            );
    }

    /**
     * Set up lightbulb service and characteristic handlers
     */
    private setupLightbulbService(bulb: BulbConfig): void {
        this.service =
            this.accessory.getService(this.homebridgeService.Lightbulb) ||
            this.accessory.addService(this.homebridgeService.Lightbulb);

        this.service.setCharacteristic(this.homebridgeCharacteristic.Name, bulb.name);

        this.service
            .getCharacteristic(this.homebridgeCharacteristic.On)
            .onSet(this.setOn.bind(this))
            .onGet(this.getOn.bind(this));

        this.service
            .getCharacteristic(this.homebridgeCharacteristic.Hue)
            .onSet(this.setHue.bind(this))
            .onGet(this.getHue.bind(this));

        this.service
            .getCharacteristic(this.homebridgeCharacteristic.Saturation)
            .onSet(this.setSaturation.bind(this))
            .onGet(this.getSaturation.bind(this));

        this.service
            .getCharacteristic(this.homebridgeCharacteristic.Brightness)
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
                    this.log.info('Found Magic Blue bulb:', mac);
                    this.peripheral = peripheral;
                    noble.stopScanningAsync().catch(console.error); // Stop scanning once found
                    if (callback) {
                        callback();
                    }
                }
            });
        } catch (error) {
            this.log.error('Error during BLE discovery:', error);
        }
    }

    /**
     * Write color data to the bulb via BLE
     */
    private async writeColor(): Promise<void> {
        const connected = await this.attemptConnect();
        if (!connected) {
            return;
        }

        const rgb: RgbColor = hslToRgb(
            this.ledsStatus.values.hue,
            this.ledsStatus.values.saturation,
            this.ledsStatus.values.lightness,
        );

        const colorCommand = Buffer.from([
            ...BLE_COMMANDS.COLOR_COMMAND_PREFIX,
            rgb.r,
            rgb.g,
            rgb.b,
            ...BLE_COMMANDS.COLOR_COMMAND_SUFFIX,
        ]);

        if (!this.peripheral) {
            this.log.error('No peripheral available for color write');
            return;
        }

        try {
            await this.peripheral.writeHandleAsync(this.handle, colorCommand, true);
        } catch (error) {
            this.log.error('BLE: Write handle Error:', error);
        }
    }

    private async attemptConnect(): Promise<boolean> {
        if (this.peripheral && this.peripheral.state === 'connected') {
            return true;
        } else if (this.peripheral && this.peripheral.state === 'disconnected') {
            this.log.info('Lost connection to bulb. Attempting reconnect...');
            try {
                await this.peripheral.connectAsync();
                this.log.info('Reconnect was successful');
                return true;
            } catch (error) {
                this.log.error('Reconnect was unsuccessful:', error);
                return false;
            }
        } else {
            this.log.warn('Bulb not found or not ready for connection');
            return false;
        }
    }

    async setOn(value: CharacteristicValue): Promise<void> {
        if (typeof value !== 'boolean') {
            return;
        }
        const code = value ? BLE_COMMANDS.TURN_ON : BLE_COMMANDS.TURN_OFF;

        const connected = await this.attemptConnect();
        if (!connected || !this.peripheral) {
            throw new Error('Could not connect to peripheral');
        }

        const powerCommand = Buffer.from([
            ...BLE_COMMANDS.POWER_COMMAND_PREFIX,
            code,
            ...BLE_COMMANDS.POWER_COMMAND_SUFFIX,
        ]);

        try {
            await this.peripheral.writeHandleAsync(this.handle, powerCommand, true);
            this.ledsStatus.on = value;
            this.log.debug('Set Characteristic On ->', value);
        } catch (error) {
            this.log.error('BLE: Write handle Error:', error);
            throw new Error(error instanceof Error ? error.message : String(error));
        }
    }

    async getOn(): Promise<CharacteristicValue> {
        this.log.debug('Get Characteristic On ->', this.ledsStatus.on);
        return this.ledsStatus.on;
    }

    async setHue(value: CharacteristicValue): Promise<void> {
        if (typeof value !== 'number') {
            return;
        }
        this.ledsStatus.values.hue = value;
        this.log.debug('Set Characteristic Hue ->', value);

        if (this.ledsStatus.on) {
            await this.writeColor();
        }
    }

    async getHue(): Promise<CharacteristicValue> {
        const hue = this.ledsStatus.values.hue;
        this.log.debug('Get Characteristic Hue ->', hue);
        return hue;
    }

    async setSaturation(value: CharacteristicValue): Promise<void> {
        if (typeof value !== 'number') {
            return;
        }
        this.ledsStatus.values.saturation = value;
        this.log.debug('Set Characteristic Saturation ->', value);

        if (this.ledsStatus.on) {
            await this.writeColor();
        }
    }

    async getSaturation(): Promise<CharacteristicValue> {
        const saturation = this.ledsStatus.values.saturation;
        this.log.debug('Get Characteristic Saturation ->', saturation);
        return saturation;
    }

    async setBrightness(value: CharacteristicValue): Promise<void> {
        if (typeof value !== 'number') {
            return;
        }
        this.ledsStatus.values.lightness = value;
        this.log.debug('Set Characteristic Brightness ->', value);

        if (this.ledsStatus.on) {
            await this.writeColor();
        }
    }

    async getBrightness(): Promise<CharacteristicValue> {
        const brightness = this.ledsStatus.values.lightness;
        this.log.debug('Get Characteristic Brightness ->', brightness);
        return brightness;
    }
}
