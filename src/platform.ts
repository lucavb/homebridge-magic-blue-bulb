import {
    API,
    Logger,
    DynamicPlatformPlugin,
    PlatformAccessory,
    PlatformConfig,
    Service,
    Characteristic,
} from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './constants';
import { BulbConfig, validatePlatformConfig, PlatformConfigType } from './types';
import { MagicBlueBulbAccessory } from './accessory';

/**
 * Magic Blue Bulb Platform Plugin
 *
 * This platform plugin manages multiple Magic Blue LED bulbs through a single platform configuration.
 * It implements the DynamicPlatformPlugin interface to support dynamic accessory discovery and management.
 */
export class MagicBlueBulbPlatform implements DynamicPlatformPlugin {
    public readonly Service: typeof Service = this.api.hap.Service;
    public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

    public readonly accessories: PlatformAccessory[] = [];

    private readonly validatedConfig: PlatformConfigType;

    constructor(public readonly log: Logger, public readonly config: PlatformConfig, public readonly api: API) {
        this.log.debug('Finished initializing platform:', this.config.name);

        try {
            this.validatedConfig = validatePlatformConfig(this.config);
            this.log.debug('Configuration validated successfully');
        } catch (error) {
            this.log.error('Configuration validation failed:', error instanceof Error ? error.message : String(error));
            throw error;
        }

        this.api.on('didFinishLaunching', () => {
            this.log.debug('Executed didFinishLaunching callback');
            this.discoverDevices();
        });
    }

    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * We should use this opportunity to setup event handlers for characteristics and update respective values.
     */
    configureAccessory(accessory: PlatformAccessory): void {
        this.log.info('Loading accessory from cache:', accessory.displayName);

        this.accessories.push(accessory);
    }

    /**
     * Discover and register Magic Blue bulb accessories.
     * This method reads the bulb configurations from the platform config and creates accessories for each bulb.
     */
    discoverDevices(): void {
        const bulbs = this.validatedConfig.bulbs;

        if (bulbs.length === 0) {
            this.log.warn('No bulbs configured in platform settings');
            return;
        }

        this.log.info(`Discovered ${bulbs.length} bulb(s) in configuration`);

        for (const bulb of bulbs) {
            this.registerBulb(bulb);
        }
    }

    /**
     * Register a single bulb as an accessory
     */
    private registerBulb(bulb: BulbConfig): void {
        const uuid = this.api.hap.uuid.generate(bulb.mac);

        const existingAccessory = this.accessories.find((accessory) => accessory.UUID === uuid);

        if (existingAccessory) {
            this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

            existingAccessory.context.bulb = bulb;

            new MagicBlueBulbAccessory(this, existingAccessory);
        } else {
            this.log.info('Adding new accessory:', bulb.name);

            const accessory = new this.api.platformAccessory(bulb.name, uuid);

            accessory.context.bulb = bulb;

            new MagicBlueBulbAccessory(this, accessory);

            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
    }
}
