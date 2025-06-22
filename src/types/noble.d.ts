declare module 'noble' {
    export interface Peripheral {
        id: string;
        address: string;
        state: string;
        connect(callback?: (error?: string | null) => void): void;
        writeHandle(
            handle: number,
            data: Buffer,
            withoutResponse: boolean,
            callback?: (error?: string | null) => void,
        ): void;
    }

    export function on(event: 'stateChange', listener: (state: string) => void): void;
    export function on(event: 'discover', listener: (peripheral: Peripheral) => void): void;
    export function startScanning(): void;
    export function stopScanning(): void;
}
