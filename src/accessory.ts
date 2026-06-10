import { API, Service, PlatformAccessory, CharacteristicValue, Characteristic, Logger } from 'homebridge';
import noble, { Peripheral } from '@stoprocent/noble';
import { hslToRgb, rgbToHsl } from './rgb-conversion';
import { BulbConfig, LedsStatus, validateBulbConfig } from './types';
import { DEFAULT_HANDLE, DEFAULT_READ_HANDLE, DEFAULT_ACCESSORY_INFO, STATUS_POLL_INTERVAL_MS } from './constants';
import {
    buildPowerOnCommand,
    buildPowerOffCommand,
    buildRgbCommand,
    buildWarmWhiteCommand,
    resolveAddressType,
    ParsedDeviceStatus,
} from './protocol';
import { readDeviceStatus, writeBleCommand, BleHandles } from './ble-transport';
import {
    MIRED_MAX,
    MIRED_MIN,
    brightnessAndMiredsToWarmWhiteIntensity,
    isWarmWhiteMireds,
    warmWhiteIntensityToMireds,
} from './color-temperature';

export class MagicBlueBulbAccessory {
    private readonly service: Service;
    private readonly ledsStatus: LedsStatus;
    private readonly mac: string;
    private readonly handles: BleHandles;
    private readonly debug: boolean;
    private readonly addressType: 'public' | 'random';

    private peripheral?: Peripheral;
    private discoverHandler?: (peripheral: Peripheral) => void;
    private statusPollTimer?: ReturnType<typeof setInterval>;
    private isApplyingState = false;

    constructor(
        private readonly log: Logger,
        private readonly homebridgeService: typeof Service,
        private readonly homebridgeCharacteristic: typeof Characteristic,
        private readonly accessory: PlatformAccessory,
        api: API,
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
            mode: 'rgb',
            values: rgbToHsl(255, 255, 255),
            colorTemperature: MIRED_MAX,
        };
        this.mac = bulb.mac.toLowerCase();
        this.handles = {
            writeHandle: bulb.handle ?? DEFAULT_HANDLE,
            readHandle: bulb.readHandle ?? DEFAULT_READ_HANDLE,
        };
        this.debug = bulb.debug ?? false;
        this.addressType = resolveAddressType(bulb.version, bulb.addressType, this.mac);

        this.setupAccessoryInformation(bulb);
        this.service = this.setupLightbulbService(bulb);

        api.on('shutdown', () => {
            this.cleanup();
        });

        this.findBulb().catch((error) => {
            this.log.error(`Failed to initialize BLE discovery for ${bulb.name}:`, error);
        });
    }

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

    private setupLightbulbService(bulb: BulbConfig) {
        const service =
            this.accessory.getService(this.homebridgeService.Lightbulb) ||
            this.accessory.addService(this.homebridgeService.Lightbulb);

        service.setCharacteristic(this.homebridgeCharacteristic.Name, bulb.name);

        service.getCharacteristic(this.homebridgeCharacteristic.On).onSet(this.setOn).onGet(this.getOn);

        service.getCharacteristic(this.homebridgeCharacteristic.Hue).onSet(this.setHue).onGet(this.getHue);

        service
            .getCharacteristic(this.homebridgeCharacteristic.Saturation)
            .onSet(this.setSaturation)
            .onGet(this.getSaturation);

        service
            .getCharacteristic(this.homebridgeCharacteristic.Brightness)
            .onSet(this.setBrightness)
            .onGet(this.getBrightness);

        const colorTemp = service.getCharacteristic(this.homebridgeCharacteristic.ColorTemperature);
        colorTemp.setProps({ minValue: MIRED_MIN, maxValue: MIRED_MAX });
        colorTemp.onSet(this.setColorTemperature).onGet(this.getColorTemperature);

        return service;
    }

    private async findBulb(): Promise<void> {
        try {
            await noble.waitForPoweredOnAsync();
            await noble.startScanningAsync();

            this.discoverHandler = (peripheral: Peripheral) => {
                if (peripheral.id === this.mac || peripheral.address.toLowerCase() === this.mac) {
                    this.log.info('Found Magic Blue bulb:', this.mac);
                    this.peripheral = peripheral;
                    if (this.discoverHandler) {
                        noble.removeListener('discover', this.discoverHandler);
                        this.discoverHandler = undefined;
                    }
                    void noble.stopScanningAsync();
                    this.onPeripheralFound();
                }
            };

            noble.on('discover', this.discoverHandler);
        } catch (error) {
            this.log.error('Error during BLE discovery:', error);
        }
    }

    private onPeripheralFound(): void {
        if (!this.peripheral) {
            return;
        }

        this.peripheral.on('disconnect', () => {
            this.log.warn('Bulb disconnected');
            this.stopStatusPolling();
        });

        void this.attemptConnect().then((connected) => {
            if (connected) {
                void this.syncFromBulb();
                this.startStatusPolling();
            }
        });
    }

    private startStatusPolling(): void {
        this.stopStatusPolling();
        this.statusPollTimer = setInterval(() => {
            void this.syncFromBulb();
        }, STATUS_POLL_INTERVAL_MS);
    }

    private stopStatusPolling(): void {
        if (this.statusPollTimer) {
            clearInterval(this.statusPollTimer);
            this.statusPollTimer = undefined;
        }
    }

    private cleanup(): void {
        this.stopStatusPolling();
        if (this.discoverHandler) {
            noble.removeListener('discover', this.discoverHandler);
            this.discoverHandler = undefined;
        }
        void noble.stopScanningAsync().catch(() => undefined);
        if (this.peripheral?.state === 'connected') {
            void this.peripheral.disconnectAsync().catch(() => undefined);
        }
    }

    private async attemptConnect(): Promise<boolean> {
        if (!this.peripheral) {
            this.log.warn('Bulb not found or not ready for connection');
            return false;
        }

        if (this.peripheral.state === 'connected') {
            return true;
        }

        if (this.peripheral.state === 'disconnected') {
            this.log.info('Connecting to bulb...');
            try {
                this.peripheral = await noble.connectAsync(this.peripheral.id, {
                    addressType: this.addressType,
                });
                this.log.info('Connection successful');
                return true;
            } catch (error) {
                this.log.error('Connection failed:', error);
                return false;
            }
        }

        this.log.warn(`Bulb in unexpected state: ${this.peripheral.state}`);
        return false;
    }

    private async syncFromBulb(): Promise<void> {
        if (this.isApplyingState) {
            return;
        }

        const connected = await this.attemptConnect();
        if (!connected || !this.peripheral) {
            return;
        }

        try {
            const status = await readDeviceStatus(this.peripheral, this.handles, this.log, this.debug);
            if (status) {
                this.applyStatusFromBulb(status);
            }
        } catch (error) {
            this.log.debug('Status read failed:', error);
        }
    }

    private applyStatusFromBulb(status: ParsedDeviceStatus): void {
        this.isApplyingState = true;
        try {
            this.ledsStatus.on = status.on;

            if (status.mode === 'warmWhite') {
                this.ledsStatus.mode = 'warmWhite';
                const brightness = Math.round((status.warmWhiteIntensity / 255) * 100);
                this.ledsStatus.values.lightness = brightness;
                this.ledsStatus.colorTemperature = warmWhiteIntensityToMireds(status.warmWhiteIntensity, brightness);
            } else {
                this.ledsStatus.mode = 'rgb';
                const hsl = rgbToHsl(status.red, status.green, status.blue);
                this.ledsStatus.values = hsl;
                const maxChannel = Math.max(status.red, status.green, status.blue);
                this.ledsStatus.values.lightness = Math.round((maxChannel / 255) * 100);
            }

            this.updateHomeKitCharacteristics();
        } finally {
            this.isApplyingState = false;
        }
    }

    private updateHomeKitCharacteristics(): void {
        this.service.updateCharacteristic(this.homebridgeCharacteristic.On, this.ledsStatus.on);
        this.service.updateCharacteristic(this.homebridgeCharacteristic.Brightness, this.ledsStatus.values.lightness);
        this.service.updateCharacteristic(this.homebridgeCharacteristic.Hue, this.ledsStatus.values.hue);
        this.service.updateCharacteristic(this.homebridgeCharacteristic.Saturation, this.ledsStatus.values.saturation);
        this.service.updateCharacteristic(
            this.homebridgeCharacteristic.ColorTemperature,
            this.ledsStatus.colorTemperature,
        );
    }

    private async applyLightState(): Promise<void> {
        const connected = await this.attemptConnect();
        if (!connected || !this.peripheral) {
            return;
        }

        if (!this.ledsStatus.on) {
            await writeBleCommand(this.peripheral, this.handles, buildPowerOffCommand(), this.log, this.debug);
            return;
        }

        await writeBleCommand(this.peripheral, this.handles, buildPowerOnCommand(), this.log, this.debug);

        if (this.ledsStatus.mode === 'warmWhite') {
            const intensity = brightnessAndMiredsToWarmWhiteIntensity(
                this.ledsStatus.values.lightness,
                this.ledsStatus.colorTemperature,
            );
            await writeBleCommand(
                this.peripheral,
                this.handles,
                buildWarmWhiteCommand(intensity),
                this.log,
                this.debug,
            );
            return;
        }

        const rgb = hslToRgb(
            this.ledsStatus.values.hue,
            this.ledsStatus.values.saturation,
            this.ledsStatus.values.lightness,
        );
        await writeBleCommand(
            this.peripheral,
            this.handles,
            buildRgbCommand(rgb.r, rgb.g, rgb.b),
            this.log,
            this.debug,
        );
    }

    private setOn = async (value: CharacteristicValue): Promise<void> => {
        if (typeof value !== 'boolean') {
            return;
        }

        this.ledsStatus.on = value;
        this.log.debug('Set Characteristic On ->', value);

        try {
            await this.applyLightState();
        } catch (error) {
            this.log.error('Failed to set power state:', error);
            throw error instanceof Error ? error : new Error(String(error));
        }
    };

    private getOn = async (): Promise<CharacteristicValue> => {
        this.log.debug('Get Characteristic On ->', this.ledsStatus.on);
        return this.ledsStatus.on;
    };

    private setHue = async (value: CharacteristicValue): Promise<void> => {
        if (typeof value !== 'number') {
            return;
        }
        this.ledsStatus.mode = 'rgb';
        this.ledsStatus.values.hue = value;
        this.log.debug('Set Characteristic Hue ->', value);

        if (this.ledsStatus.on) {
            await this.applyLightState();
        }
    };

    private getHue = async (): Promise<CharacteristicValue> => {
        const hue = this.ledsStatus.values.hue;
        this.log.debug('Get Characteristic Hue ->', hue);
        return hue;
    };

    private setSaturation = async (value: CharacteristicValue): Promise<void> => {
        if (typeof value !== 'number') {
            return;
        }
        this.ledsStatus.mode = 'rgb';
        this.ledsStatus.values.saturation = value;
        this.log.debug('Set Characteristic Saturation ->', value);

        if (this.ledsStatus.on) {
            await this.applyLightState();
        }
    };

    private getSaturation = async (): Promise<CharacteristicValue> => {
        const saturation = this.ledsStatus.values.saturation;
        this.log.debug('Get Characteristic Saturation ->', saturation);
        return saturation;
    };

    private setBrightness = async (value: CharacteristicValue): Promise<void> => {
        if (typeof value !== 'number') {
            return;
        }
        this.ledsStatus.values.lightness = value;
        this.log.debug('Set Characteristic Brightness ->', value);

        if (this.ledsStatus.on) {
            await this.applyLightState();
        }
    };

    private getBrightness = async (): Promise<CharacteristicValue> => {
        const brightness = this.ledsStatus.values.lightness;
        this.log.debug('Get Characteristic Brightness ->', brightness);
        return brightness;
    };

    private setColorTemperature = async (value: CharacteristicValue): Promise<void> => {
        if (typeof value !== 'number') {
            return;
        }
        this.ledsStatus.colorTemperature = value;
        this.ledsStatus.mode = isWarmWhiteMireds(value) ? 'warmWhite' : 'rgb';
        if (this.ledsStatus.mode === 'rgb') {
            this.ledsStatus.values.hue = 0;
            this.ledsStatus.values.saturation = 0;
        }
        this.log.debug('Set Characteristic ColorTemperature ->', value);

        if (this.ledsStatus.on) {
            await this.applyLightState();
        }
    };

    private getColorTemperature = async (): Promise<CharacteristicValue> => {
        const colorTemperature = this.ledsStatus.colorTemperature;
        this.log.debug('Get Characteristic ColorTemperature ->', colorTemperature);
        return colorTemperature;
    };
}
