import { API } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './constants';
import { MagicBlueBulbPlatform } from './platform';

export default (api: API): void => {
    api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, MagicBlueBulbPlatform);
};
