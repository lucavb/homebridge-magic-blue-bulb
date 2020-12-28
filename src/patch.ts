import { JQueryStyleEventEmitter } from 'rxjs/internal/observable/fromEvent';
import { EventEmitter } from 'events';

interface EmitterMix {
    on(event: string, listener: Function): EventEmitter;
    removeListener(event: string, listener: Function): EventEmitter;
}

export const patchEventMismatch = (emitter: EmitterMix): JQueryStyleEventEmitter => ({
    on: emitter.on,
    off: emitter.removeListener,
});
