import { API } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './constants';
import { MagicBlueBulbPlatform } from './platform';

/**
 * This is the main entry point for the homebridge-magic-blue-bulb plugin.
 * This method registers the platform with Homebridge.
 */
export default (api: API): void => {
    api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, MagicBlueBulbPlatform);
};
