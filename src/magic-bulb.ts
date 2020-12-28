import { Peripheral } from '@abandonware/noble';
import { BehaviorSubject, bindCallback, from, fromEvent, Observable, of, Subject, throwError } from 'rxjs';
import { distinctUntilChanged, map, mapTo, switchMap, take, takeUntil, tap } from 'rxjs/operators';
import { RGB } from './interfaces';

export class MagicBlueBulb {
    private readonly terminate = new Subject<void>();
    private readonly connected = new BehaviorSubject<boolean>(false);

    constructor(private readonly peripheral: Peripheral, private readonly handle: number) {
        fromEvent<string | undefined>(this.peripheral, 'connect')
            .pipe(
                map((err?: string) => !err),
                takeUntil(this.terminate),
            )
            .subscribe(this.connected);

        fromEvent<string | undefined>(this.peripheral, 'disconnect')
            .pipe(mapTo(false), takeUntil(this.terminate))
            .subscribe(this.connected);
    }

    destroy(): void {
        this.terminate.next();
    }

    turnOn(): Observable<void> {
        return this.turnOnOff(true);
    }

    turnOff(): Observable<void> {
        return this.turnOnOff(false);
    }

    setColor({ red, green, blue }: RGB): Observable<void> {
        return this.send([0x56, red, green, blue, 0x00, 0xf0, 0xaa, 0x3b, 0x07, 0x00, 0x01]);
    }

    private turnOnOff(on: boolean): Observable<void> {
        const code = on ? 0x23 : 0x24;
        return this.send([0xcc, code, 0x33]);
    }

    private send(payload: number[]): Observable<void> {
        return this.connected.pipe(
            distinctUntilChanged(),
            take(1),
            switchMap(
                (connected: boolean): Observable<string | undefined> =>
                    !connected ? bindCallback(this.peripheral.connect)() : of(),
            ),
            tap((err?: string) => {
                if (err) {
                    throwError(err);
                }
            }),
            take(1),
            switchMap(
                (): Observable<void> =>
                    from(
                        this.peripheral.writeHandleAsync(
                            Buffer.from(this.handle.toString()),
                            Buffer.from(payload),
                            true,
                        ),
                    ),
            ),
            takeUntil(this.terminate),
        );
    }
}
