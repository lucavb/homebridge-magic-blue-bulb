# Homebridge Magic Blue Bulb

This plugin enables you to control your MagicBlue LED light bulbs through HomeKit via Homebridge using a dynamic platform plugin.

## Installation

### Stable (`main` branch → npm `latest`)

```bash
npm install -g homebridge-magic-blue-bulb
```

### Beta (`beta` branch → npm `beta`)

Warm white, color temperature, and state sync ship from the **`beta`** branch only. They are not fully hardware-validated:

```bash
npm install -g homebridge-magic-blue-bulb@beta
```

You may need to use `sudo` with either command.

When beta is validated, merge `beta` → `main`. The next push to `main` publishes a stable release on `latest`.

## Configuration

Add this platform to your homebridge `config.json`:

```json
{
    "platforms": [
        {
            "name": "Magic Blue Bulbs",
            "platform": "MagicBlueBulbPlatform",
            "bulbs": [
                {
                    "name": "Living Room Light",
                    "mac": "aa:bb:cc:dd:ee:ff",
                    "handle": 12,
                    "manufacturer": "Magic Blue",
                    "model": "RGB Bulb",
                    "serial": "MB001"
                },
                {
                    "name": "Bedroom Light",
                    "mac": "ff:ee:dd:cc:bb:aa",
                    "handle": 12,
                    "manufacturer": "Magic Blue",
                    "model": "RGB Bulb",
                    "serial": "MB002"
                }
            ]
        }
    ]
}
```

## Configuration Validation

This plugin uses **Zod** for runtime configuration validation, providing enhanced error reporting and type safety:

- **MAC Address Validation**: Ensures MAC addresses follow the correct format (e.g., `AA:BB:CC:DD:EE:FF` or `aa-bb-cc-dd-ee-ff`)
- **Required Fields**: Validates that essential fields like `name` and `mac` are present and non-empty
- **Type Safety**: Ensures numeric fields like `handle` are proper integers
- **Clear Error Messages**: Provides detailed error messages when configuration is invalid

### Example Validation Errors

If you provide an invalid configuration, you'll see helpful error messages in the Homebridge logs:

```
[Magic Blue Bulbs] Configuration validation failed: mac: Invalid MAC address format, name: Bulb name is required
```

### Platform Configuration Options

| Key        | Description                                        |
| ---------- | -------------------------------------------------- |
| `name`     | Required. The name of this platform instance       |
| `platform` | Required. Must be "MagicBlueBulbPlatform"          |
| `bulbs`    | Required. Array of bulb configurations (see below) |

### Bulb Configuration Options

| Key            | Description                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `name`         | Required. The name of this bulb in your HomeKit app                                                  |
| `mac`          | Required. The MAC address of your Magic Blue bulb                                                    |
| `handle`       | Optional. BLE write handle for commands (default `12` / `0x000c`)                                    |
| `readHandle`   | Optional. BLE read handle for status (default `15` / `0x000f`)                                       |
| `version`      | Optional. Bulb firmware version from the official app (`6`–`10`); selects BLE address type if needed |
| `addressType`  | Optional. `"public"` or `"random"` BLE address type override                                         |
| `debug`        | Optional. Log raw BLE traffic to help troubleshoot connection issues                                 |
| `manufacturer` | Optional. Manufacturer name, defaults to "Light"                                                     |
| `model`        | Optional. Model name, defaults to "Magic Blue"                                                       |
| `serial`       | Optional. Serial number, defaults to "5D4989E80E44"                                                  |

## HomeKit features (beta)

This plugin exposes a standard HomeKit **Lightbulb** with:

- **On** — power on/off (restores last color or warm-white when turning on)
- **Brightness**, **Hue**, **Saturation** — RGB color control
- **Color Temperature** — warm white via the bulb's dedicated WW channel

State is polled from the bulb after connect so HomeKit stays closer in sync when the bulb is changed elsewhere.

> **Beta notice:** Warm white, color temperature mapping, and state readback are ported from the community [Betree/magicblue](https://github.com/Betree/magicblue) protocol reference and are **not fully hardware-validated** by the maintainer. If something misbehaves, open an issue with your bulb `version`, `handle`, OS, and set `"debug": true` to capture BLE logs.

### Validation checklist (please report back)

1. Does on/off work reliably after reconnect?
2. Does RGB color match what you set in the Home app?
3. Does the color temperature slider produce visible warm white (not just dim RGB white)?
4. If you change the bulb with the official app, does HomeKit update within ~30 seconds?

Magic Blue **effects** and **schedules** are not supported — use the official app or HomeKit automations instead.

## Migration from v1.x

If you're upgrading from v1.x, you'll need to update your configuration from an accessory-based setup to a platform-based setup:

### Old Configuration (v1.x)

```json
{
    "accessories": [
        {
            "accessory": "magic-blue-bulb",
            "name": "Magic Blue Bulb",
            "mac": "aa:bb:cc:dd:ee:ff"
        }
    ]
}
```

### New Configuration (v2.x)

```json
{
    "platforms": [
        {
            "name": "Magic Blue Bulbs",
            "platform": "MagicBlueBulbPlatform",
            "bulbs": [
                {
                    "name": "Magic Blue Bulb",
                    "mac": "aa:bb:cc:dd:ee:ff"
                }
            ]
        }
    ]
}
```

## Benefits of Platform Plugin

The new platform plugin architecture provides several advantages:

- **Multiple Bulbs**: Easily manage multiple Magic Blue bulbs from a single platform configuration
- **Better Performance**: Improved caching and accessory management
- **Future-Proof**: Uses Homebridge's recommended modern architecture
- **Easier Management**: Centralized configuration for all your Magic Blue devices

## Finding Your Bulb's MAC Address

The light bulb uses Bluetooth Low Energy. To discover your bulb's MAC address, install bluez and run:

```bash
sudo hcitool lescan
```

Look for a device named "LEDBLE-" followed by some characters - that's your Magic Blue bulb.

Example output:

```
LE Scan ...
FF:FF:C8:5D:68:9E Eve
FF:FF:C8:5D:68:9E Eve Thermo
33:03:44:44:AA:5C (unknown)
33:03:44:44:AA:5C Eve Door
aa:bb:cc:dd:ee:ff (unknown)
22:20:7B:99:D3:AF (unknown)
aa:bb:cc:dd:ee:ff LEDBLE-A582661F    <--- this is your light bulb
22:20:7B:99:D3:AF (unknown)
```

## Development

This project is written in TypeScript and built with [tsdown](https://tsdown.dev/). To develop and contribute:

### Setup

```bash
npm install
```

Requires Node.js **22.18+** for building (tsdown) and **22.12+** or **24+** at runtime.

### Build

```bash
npm run build
```

### Watch mode (for development)

```bash
npm run watch
```

Link the plugin into your local Homebridge install:

```bash
npm link
```

The TypeScript source files are in `src/` and the compiled output is in `dist/` (`index.mjs`, `index.cjs`, and type declarations).

### Project Structure

```
homebridge-magic-blue-bulb/
├── src/
│   ├── index.ts              # Plugin registration and entry point
│   ├── platform.ts           # Main platform class
│   ├── accessory.ts          # Individual bulb accessory implementation
│   ├── constants.ts          # BLE commands and default values
│   ├── protocol.ts           # BLE command builders and status parser
│   ├── ble-transport.ts      # Noble read/write helpers
│   ├── color-temperature.ts  # HomeKit mireds ↔ warm-white mapping
│   ├── rgb-conversion.ts     # HSL/RGB color conversion utilities
│   └── types.ts              # TypeScript type definitions and validation
├── test/                     # Vitest specs (*.spec.ts)
├── dist/                     # Compiled JavaScript output
├── tsconfig.json            # TypeScript configuration
└── package.json             # Dependencies and scripts
```

## Requirements

- Node.js `^22.12.0` or `^24.0.0`
- Homebridge `^1.8.0` or `^2.0.0`
- Bluetooth LE support on your system

## Homebridge v2.0 Compatibility

This plugin supports Homebridge v2.0 and remains compatible with Homebridge v1.8+ on Node 22+. It uses:

- Modern dynamic platform plugin architecture
- Current HAP-NodeJS APIs (no deprecated patterns)
- TypeScript with strict typing
- Zod validation for enhanced configuration safety
- Dual ESM/CJS build output via tsdown

Users on Homebridge v2 will see a green checkmark in the UI readiness check once this plugin version is installed.

## Issues

This software comes with no warranty. It works for me and it might for you. If you encounter issues, please open an [issue](https://github.com/lucavb/homebridge-magic-blue-bulb/issues/new) on GitHub.

## Credits

- Bluetooth protocol discovered by the author of [this post](https://bene.tweakblogs.net/blog/12447/connect-a-bluetooth-lightbulb-to-philips-hue) and used in [this repository](https://github.com/b0tting/magicbluehue)
- Color conversion methods by Garry Tan - [see his post here](http://axonflux.com/handy-rgb-to-hsl-and-rgb-to-hsv-color-model-c)

## License

GPL-3.0
