var Service;
var Characteristic;
var HomebridgeAPI;
var noble = require('@abandonware/noble');
var rgbConversion = require('./rgbConversion');

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    HomebridgeAPI = homebridge;

    homebridge.registerAccessory('homebridge-magic-triones', 'magic-triones', MagicTriones);
};

function MagicTriones(log, config) {
    this.log = log;
    this.name = config.name;
    this.ledsStatus = {
        on: true,
        values: rgbConversion.rgbToHsl(255, 255, 255),
    };
    this.mac = config.mac.toLowerCase();
    this.handle = config.handle || 0x0007; // v9 is 0x000b

    this.findBulb(this.mac);

    // info service
    this.informationService = new Service.AccessoryInformation();

    this.informationService
        .setCharacteristic(Characteristic.Manufacturer, config.manufacturer || 'Light')
        .setCharacteristic(Characteristic.Model, config.model || 'Magic Triones')
        .setCharacteristic(Characteristic.SerialNumber, config.serial || '5D4989E80E44');

    this.service = new Service.Lightbulb(this.name);

    this.service.getCharacteristic(Characteristic.On).on('get', this.getState.bind(this));
    this.service.getCharacteristic(Characteristic.On).on('set', this.setState.bind(this));

    this.service.getCharacteristic(Characteristic.Hue).on('get', this.getHue.bind(this));
    this.service.getCharacteristic(Characteristic.Hue).on('set', this.setHue.bind(this));

    this.service.getCharacteristic(Characteristic.Saturation).on('get', this.getSat.bind(this));
    this.service.getCharacteristic(Characteristic.Saturation).on('set', this.setSat.bind(this));

    this.service.getCharacteristic(Characteristic.Brightness).on('get', this.getBright.bind(this));
    this.service.getCharacteristic(Characteristic.Brightness).on('set', this.setBright.bind(this));
}

MagicTriones.prototype.findBulb = function (mac, callback) {
    var that = this;
    noble.on('stateChange', function (state) {
        if (state === 'poweredOn') {
            noble.startScanning();
        } else {
            noble.stopScanning();
        }
    });

    noble.on('discover', function (peripheral) {
        if (peripheral.id === mac || peripheral.address === mac) {
            that.log('found my Triones');
            that.peripheral = peripheral;
        }
    });
};

MagicTriones.prototype.writeColor = function (callback) {
    var that = this;
    var temp = function (res) {
        if (!res) {
            //callback(new Error());
            return;
        }
        var rgb = rgbConversion.hslToRgb(
            that.ledsStatus.values[0],
            that.ledsStatus.values[1],
            that.ledsStatus.values[2],
        );
        that.peripheral.writeHandle(
            that.handle,
            new Buffer([0x56, rgb.r, rgb.g, rgb.b, 0x00, 0xf0, 0xaa]),
            true,
            function (error) {
                if (error) console.log('BLE: Write handle Error: ' + error);
                callback();
            },
        );
    };
    this.attemptConnect(temp);
};

MagicTriones.prototype.attemptConnect = function (callback) {
    if (this.peripheral && this.peripheral.state == 'connected') {
        callback(true);
    } else if (this.peripheral && this.peripheral.state == 'disconnected') {
        this.log('lost connection to bulb. attempting reconnect ...');
        var that = this;
        this.peripheral.connect(function (error) {
            if (!error) {
                that.log('reconnect was successful');
                callback(true);
            } else {
                that.log('reconnect was unsuccessful');
                callback(false);
            }
        });
    }
};

MagicTriones.prototype.setState = function (status, callback) {
    var code = 0x24,
        that = this;
    if (status) {
        code = 0x23;
    }
    var temp = function (res) {
        if (!that.peripheral || !res) {
            callback(new Error());
            return;
        }
        that.peripheral.writeHandle(that.handle, new Buffer([0xcc, code, 0x33]), true, function (error) {
            if (error) that.log('BLE: Write handle Error: ' + error);
            callback();
        });
    };
    this.attemptConnect(temp);
    this.ledsStatus.on = status;
};

MagicTriones.prototype.getState = function (callback) {
    callback(null, this.ledsStatus.on);
};

MagicTriones.prototype.getHue = function (callback) {
    callback(null, this.ledsStatus.values[0]);
};

MagicTriones.prototype.setHue = function (level, callback) {
    this.ledsStatus.values[0] = level;
    if (this.ledsStatus.on) {
        this.writeColor(function () {
            callback();
        });
    } else {
        callback();
    }
};

MagicTriones.prototype.getSat = function (callback) {
    callback(null, this.ledsStatus.values[1]);
};

MagicTriones.prototype.setSat = function (level, callback) {
    this.ledsStatus.values[1] = level;
    if (this.ledsStatus.on) {
        this.writeColor(function () {
            callback();
        });
    } else {
        callback();
    }
};

MagicTriones.prototype.getBright = function (callback) {
    callback(null, this.ledsStatus.values[2]);
};

MagicTriones.prototype.setBright = function (level, callback) {
    this.ledsStatus.values[2] = level;
    if (this.ledsStatus.on) {
        this.writeColor(function () {
            callback();
        });
    } else {
        callback();
    }
};

MagicTriones.prototype.getServices = function () {
    return [this.informationService, this.service];
};
