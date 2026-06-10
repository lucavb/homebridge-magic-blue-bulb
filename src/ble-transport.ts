import { Peripheral } from '@stoprocent/noble';
import { Logger } from 'homebridge';
import { buildStatusRequestCommand, parseDeviceStatus, ParsedDeviceStatus } from './protocol';

export interface BleHandles {
    writeHandle: number;
    readHandle: number;
}

const STATUS_READ_DELAY_MS = 150;

export async function writeBleCommand(
    peripheral: Peripheral,
    handles: BleHandles,
    command: Buffer,
    log: Logger,
    debug: boolean,
): Promise<void> {
    if (debug) {
        log.info(`BLE write handle 0x${handles.writeHandle.toString(16)}: ${command.toString('hex')}`);
    }
    await peripheral.writeHandleAsync(handles.writeHandle, command, true);
}

export async function readDeviceStatus(
    peripheral: Peripheral,
    handles: BleHandles,
    log: Logger,
    debug: boolean,
): Promise<ParsedDeviceStatus | null> {
    const request = buildStatusRequestCommand();
    await writeBleCommand(peripheral, handles, request, log, debug);

    await new Promise((resolve) => setTimeout(resolve, STATUS_READ_DELAY_MS));

    const buffer = await peripheral.readHandleAsync(handles.readHandle);
    if (debug) {
        log.info(`BLE read handle 0x${handles.readHandle.toString(16)}: ${buffer.toString('hex')}`);
    }

    return parseDeviceStatus(buffer);
}
