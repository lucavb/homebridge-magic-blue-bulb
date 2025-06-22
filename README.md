# Homebridge Magic Blue Bulb

This plugin enables you to control your MagicBlue LED light bulbs through HomeKit via Homebridge using a dynamic platform plugin.

## Installation

```bash
npm install -g homebridge-magic-blue-bulb
```

You may need to use `sudo` with that command.

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
                    "mac": "FB:00:E0:82:AA:1F",
                    "handle": 12,
                    "manufacturer": "Magic Blue",
                    "model": "RGB Bulb",
                    "serial": "MB001"
                },
                {
                    "name": "Bedroom Light",
                    "mac": "AA:BB:CC:DD:EE:FF",
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

-   **MAC Address Validation**: Ensures MAC addresses follow the correct format (e.g., `AA:BB:CC:DD:EE:FF` or `aa-bb-cc-dd-ee-ff`)
-   **Required Fields**: Validates that essential fields like `name` and `mac` are present and non-empty
-   **Type Safety**: Ensures numeric fields like `handle` are proper integers
-   **Clear Error Messages**: Provides detailed error messages when configuration is invalid

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

| Key            | Description                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| `name`         | Required. The name of this bulb in your HomeKit app                                                   |
| `mac`          | Required. The MAC address of your Magic Blue bulb                                                     |
| `handle`       | Optional. BLE handle for commands. Use 46 for newer bulbs, defaults to 12 (0x000c) for older versions |
| `manufacturer` | Optional. Manufacturer name, defaults to "Light"                                                      |
| `model`        | Optional. Model name, defaults to "Magic Blue"                                                        |
| `serial`       | Optional. Serial number, defaults to "5D4989E80E44"                                                   |

## Migration from v1.x

If you're upgrading from v1.x, you'll need to update your configuration from an accessory-based setup to a platform-based setup:

### Old Configuration (v1.x)

```json
{
    "accessories": [
        {
            "accessory": "magic-blue-bulb",
            "name": "Magic Blue Bulb",
            "mac": "FB:00:E0:82:AA:1F"
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
                    "mac": "FB:00:E0:82:AA:1F"
                }
            ]
        }
    ]
}
```

## Benefits of Platform Plugin

The new platform plugin architecture provides several advantages:

-   **Multiple Bulbs**: Easily manage multiple Magic Blue bulbs from a single platform configuration
-   **Better Performance**: Improved caching and accessory management
-   **Future-Proof**: Uses Homebridge's recommended modern architecture
-   **Easier Management**: Centralized configuration for all your Magic Blue devices

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
FB:00:E0:82:AA:1F (unknown)
22:20:7B:99:D3:AF (unknown)
FB:00:E0:82:AA:1F LEDBLE-A582661F    <--- this is your light bulb
22:20:7B:99:D3:AF (unknown)
```

## Development

This project is written in TypeScript. To develop and contribute:

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

### Watch mode (for development)

```bash
npm run watch
```

The TypeScript source files are in `src/` and the compiled JavaScript output is in `dist/`.

### Project Structure

```
homebridge-magic-blue-bulb/
├── src/
│   ├── index.ts              # Main plugin file
│   ├── rgbConversion.ts      # Color conversion utilities
│   └── types/
│       └── noble.d.ts        # Type definitions for Noble
├── dist/                     # Compiled JavaScript output
├── tsconfig.json            # TypeScript configuration
└── package.json             # Dependencies and scripts
```

## Requirements

-   Node.js >= 14.0.0
-   Homebridge >= 1.3.0
-   Bluetooth LE support on your system

## Issues

This software comes with no warranty. It works for me and it might for you. If you encounter issues, please open an [issue](https://github.com/lucavb/homebridge-magic-blue-bulb/issues/new) on GitHub.

## Credits

-   Bluetooth protocol discovered by the author of [this post](https://bene.tweakblogs.net/blog/12447/connect-a-bluetooth-lightbulb-to-philips-hue) and used in [this repository](https://github.com/b0tting/magicbluehue)
-   Color conversion methods by Garry Tan - [see his post here](http://axonflux.com/handy-rgb-to-hsl-and-rgb-to-hsv-color-model-c)

## License

GPL-3.0
