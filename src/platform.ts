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
import { BulbConfig } from './types';
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

    // Track restored cached accessories
    public readonly accessories: PlatformAccessory[] = [];

    constructor(public readonly log: Logger, public readonly config: PlatformConfig, public readonly api: API) {
        this.log.debug('Finished initializing platform:', this.config.name);

        // When this event is fired it means Homebridge has restored all cached accessories from disk.
        this.api.on('didFinishLaunching', () => {
            this.log.debug('Executed didFinishLaunching callback');
            // Run the method to discover / register your devices as accessories
            this.discoverDevices();
        });
    }

    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * We should use this opportunity to setup event handlers for characteristics and update respective values.
     */
    configureAccessory(accessory: PlatformAccessory): void {
        this.log.info('Loading accessory from cache:', accessory.displayName);

        // Add the restored accessory to the accessories cache so we can track if it has already been registered
        this.accessories.push(accessory);
    }

    /**
     * Discover and register Magic Blue bulb accessories.
     * This method reads the bulb configurations from the platform config and creates accessories for each bulb.
     */
    discoverDevices(): void {
        // Get bulbs from config
        const bulbs = (this.config.bulbs as BulbConfig[]) || [];

        if (bulbs.length === 0) {
            this.log.warn('No bulbs configured in platform settings');
            return;
        }

        // Loop over the discovered devices and register each one if it has not already been registered
        for (const bulb of bulbs) {
            this.registerBulb(bulb);
        }
    }

    /**
     * Register a single bulb as an accessory
     */
    private registerBulb(bulb: BulbConfig): void {
        // Generate a unique id for the accessory
        const uuid = this.api.hap.uuid.generate(bulb.mac);

        // See if an accessory with the same uuid has already been registered and restored from
        // the cached devices we stored in the `configureAccessory` method above
        const existingAccessory = this.accessories.find((accessory) => accessory.UUID === uuid);

        if (existingAccessory) {
            // The accessory already exists
            this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

            // Update the accessory context with the latest bulb config
            existingAccessory.context.bulb = bulb;

            // Create the accessory handler for the restored accessory
            new MagicBlueBulbAccessory(this, existingAccessory);

            // It is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`
            // This should be done when the device is no longer available
        } else {
            // The accessory does not yet exist, so we need to create it
            this.log.info('Adding new accessory:', bulb.name);

            // Create a new accessory
            const accessory = new this.api.platformAccessory(bulb.name, uuid);

            // Store a copy of the bulb config in the `accessory.context`
            accessory.context.bulb = bulb;

            // Create the accessory handler for the newly create accessory
            new MagicBlueBulbAccessory(this, accessory);

            // Link the accessory to your platform
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
    }
}
