import { API } from 'homebridge';
import { Characteristic as HapCharacteristic, Service as HapService } from 'hap-nodejs';
import { MagicBluePlugin } from './magic-blue-plugin';

export let Service: typeof HapService;
export let Characteristic: typeof HapCharacteristic;

export default (homebridge: API): void => {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory('homebridge-magic-blue-bulb', 'magic-blue-bulb', MagicBluePlugin);
};
