import { AccessoryPlugin, API, CharacteristicGetCallback, CharacteristicSetCallback, Logging } from 'homebridge';
import { Service as HapService } from 'hap-nodejs';
import * as noble from '@abandonware/noble';
import { Peripheral } from '@abandonware/noble';
import { hsv as hsvConvert } from 'color-convert';
import { from, fromEvent, Observable, of, Subject } from 'rxjs';
import { catchError, filter, switchMap, take, takeUntil, tap } from 'rxjs/operators';
import { MagicBlueBulb } from './magic-bulb';
import { BulbState, MagicBlueBulbConfig } from './interfaces';
import { patchEventMismatch } from './patch';
import { Characteristic, Service } from './index';

const patchedNoble = patchEventMismatch(noble);
const DEFAULT_HANDLE = 0x000c;
const V9_HANDLE = 0x000b;

type HSVKeys = 'hue' | 'saturation' | 'lightness';

export class MagicBluePlugin implements AccessoryPlugin {
    private bulb?: MagicBlueBulb;
    private readonly ledStatus: BulbState;
    private readonly handle: number;

    private readonly terminate = new Subject<void>();
    private readonly terminatePendingRequests = new Subject<void>();

    private readonly services: HapService[] = [];

    constructor(
        private readonly logger: Logging,
        private readonly config: MagicBlueBulbConfig,
        private readonly api: API,
    ) {
        if (typeof this.config.mac !== 'string') {
            throw new Error('The mac address needs to be present and needs to be a string');
        }

        this.ledStatus = {
            on: true,
            hue: 0,
            saturation: 0,
            lightness: 100,
        };
        this.config.mac = this.config.mac.toLowerCase();
        this.handle = this.config.handle ?? DEFAULT_HANDLE;

        this.api.on('shutdown', () => {
            this.terminate.next();
            this.bulb?.destroy();
        });

        this.findBulb();
        this.setupAccessoryInformationService();
        this.setupLightBulbService();
    }

    private findBulb(): void {
        const stateChangeSubscription = fromEvent<string>(patchedNoble, 'stateChange')
            .pipe(
                switchMap(
                    (state: string): Observable<unknown> => {
                        return state === 'poweredOn'
                            ? from(noble.startScanningAsync())
                            : from(noble.stopScanningAsync());
                    },
                ),
                takeUntil(this.terminate),
            )
            .subscribe();

        fromEvent<Peripheral>(patchedNoble, 'discover')
            .pipe(
                filter(
                    ({ address, id }: Peripheral): boolean =>
                        id.toLowerCase() === this.config.mac || address.toLowerCase() === this.config.mac,
                ),
                take(1),
                tap((peripheral: Peripheral): void => {
                    this.logger('found my bulb');
                    this.bulb = new MagicBlueBulb(peripheral, this.handle);
                    stateChangeSubscription.unsubscribe();
                }),
                takeUntil(this.terminate),
            )
            .subscribe();
    }

    private setupAccessoryInformationService(): void {
        const service = new Service.AccessoryInformation();
        service
            .setCharacteristic(Characteristic.Manufacturer, this.config.manufacturer ?? 'Light')
            .setCharacteristic(Characteristic.Model, this.config.model ?? 'Magic Blue')
            .setCharacteristic(Characteristic.SerialNumber, this.config.serial ?? '5D4989E80E44');
        this.services.push(service);
    }

    private setupLightBulbService(): void {
        const service = new Service.Lightbulb(this.config.name);

        const setGenerator = (key: HSVKeys) => {
            return (newValue: unknown, callback: CharacteristicSetCallback): void => {
                if (typeof newValue === 'number') {
                    this.ledStatus[key] = newValue;
                    this.writeToBulb(callback);
                } else {
                    callback();
                }
            };
        };

        const getGenerator = (key: HSVKeys | 'on') => (callback: CharacteristicGetCallback): void =>
            callback(null, this.ledStatus[key]);

        const onCharacteristic = service.getCharacteristic(Characteristic.On);
        onCharacteristic
            .on(this.api.hap.CharacteristicEventTypes.GET, getGenerator('on'))
            .on(this.api.hap.CharacteristicEventTypes.SET, (newValue: unknown, callback: CharacteristicSetCallback) => {
                if (typeof newValue === 'boolean') {
                    this.ledStatus.on = newValue;
                    if (this.bulb) {
                        const f = newValue ? this.bulb.turnOn : this.bulb.turnOff;
                        f()
                            .pipe(
                                take(1),
                                tap(() => callback()),
                                catchError((err) => {
                                    callback(err);
                                    return of();
                                }),
                                takeUntil(this.terminatePendingRequests),
                                takeUntil(this.terminate),
                            )
                            .subscribe();
                        return;
                    }
                }
                callback();
            });

        const hue = service.getCharacteristic(Characteristic.Hue);
        hue.on(this.api.hap.CharacteristicEventTypes.GET, getGenerator('hue'));
        hue.on(this.api.hap.CharacteristicEventTypes.SET, setGenerator('hue'));

        const saturation = service.getCharacteristic(Characteristic.Saturation);
        saturation.on(this.api.hap.CharacteristicEventTypes.GET, getGenerator('saturation'));
        saturation.on(this.api.hap.CharacteristicEventTypes.SET, setGenerator('saturation'));

        const brightness = service.getCharacteristic(Characteristic.Brightness);
        brightness.on(this.api.hap.CharacteristicEventTypes.GET, getGenerator('lightness'));
        brightness.on(this.api.hap.CharacteristicEventTypes.SET, setGenerator('lightness'));

        this.services.push(service);
    }

    private writeToBulb(callback: CharacteristicSetCallback): void {
        this.terminatePendingRequests.next();
        if (this.ledStatus.on && this.bulb) {
            const [red, green, blue] = hsvConvert.rgb([
                this.ledStatus.hue,
                this.ledStatus.saturation,
                this.ledStatus.lightness,
            ]);
            this.bulb
                .setColor({ red, green, blue })
                .pipe(
                    take(1),
                    tap(() => callback()),
                    catchError((err) => {
                        callback(err);
                        return of();
                    }),
                    takeUntil(this.terminatePendingRequests),
                    takeUntil(this.terminate),
                )
                .subscribe();
            return;
        }
        callback();
    }

    getServices(): HapService[] {
        return this.services;
    }
}
