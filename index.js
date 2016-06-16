var Service;
var Characteristic;
var HomebridgeAPI;
var noble = require('noble');
var rgbConversion = require("./rgbConversion");


module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    HomebridgeAPI = homebridge;

    // console.log(Service.ContactSensor);
    homebridge.registerAccessory("homebridge-magic-blue-bulb", "magic-blue-bulb", MagicBlueBulb);
};


function MagicBlueBulb(log, config) {
    var that = this;
    this.log = log;
    this.name = config.name;
    this.ledsStatus = {
        "on" : true,
        "values" : rgbConversion.rgbToHsl(255, 255, 255)
    };
    this.mac = config.mac.toLowerCase();

    this.connectBulb(this.mac);
    


    // info service
    this.informationService = new Service.AccessoryInformation();
        
    this.informationService
        .setCharacteristic(Characteristic.Manufacturer, config.manufacturer || "Light")
        .setCharacteristic(Characteristic.Model, config.model || "Magic Blue")
        .setCharacteristic(Characteristic.SerialNumber, config.serial || "5D4989E80E44");




    this.service = new Service.Lightbulb(this.name);

    this.service.getCharacteristic(Characteristic.On)
        .on('get', this.getState.bind(this));
    this.service.getCharacteristic(Characteristic.On)
        .on('set', this.setState.bind(this));

    this.service.getCharacteristic(Characteristic.Hue)
        .on('get', this.getHue.bind(this));
    this.service.getCharacteristic(Characteristic.Hue)
        .on('set', this.setHue.bind(this));

    this.service.getCharacteristic(Characteristic.Saturation)
        .on('get', this.getSat.bind(this));
    this.service.getCharacteristic(Characteristic.Saturation)
        .on('set', this.setSat.bind(this));

    this.service.getCharacteristic(Characteristic.Brightness)
        .on('get', this.getBright.bind(this));
    this.service.getCharacteristic(Characteristic.Brightness)
        .on('set', this.setBright.bind(this));
}

MagicBlueBulb.prototype.connectBulb = function(mac, callback) {
    var that = this;
    noble.on('stateChange', function(state) {
        if (state === 'poweredOn') {
            noble.startScanning();
        } else {
            noble.stopScanning();
        }
    });

    noble.on('discover', function(peripheral) {
        if (peripheral.id === mac || peripheral.address === mac) {
            noble.stopScanning();
            peripheral.connect(function(error) {
                if (!error) {
                    that.peripheral = peripheral;
                } else {
                    console.log(error);
                }
                if (callback) callback();
                peripheral.on('disconnect', function() {
                    that.peripheral = null;
                });
            });
        }
    });
};

MagicBlueBulb.prototype.writeColor = function(callback) {
    var that = this;
    var temp = function() {
        var rgb = rgbConversion.hslToRgb(that.ledsStatus.values[0], that.ledsStatus.values[1], that.ledsStatus.values[2]);
        that.peripheral.writeHandle(0x000c, new Buffer([0x56, rgb.r, rgb.g, rgb.b, 0x00, 0xf0, 0xaa, 0x3b, 0x07, 0x00, 0x01]), true, function (error) {
            if (error) console.log('BLE: Write handle Error: ' + error);
            callback();
        });
    }
    if (this.peripheral) {
        temp();
    } else {
        connectBulb(this.mac, temp);
    }
}

MagicBlueBulb.prototype.setState = function(status, callback) {
    if (status) {
        this.peripheral.writeHandle(0x000c, new Buffer([0xcc, 0x23, 0x33]), true, function (error) {
            if (error) console.log('BLE: Write handle Error: ' + error);
            callback();
        });
    } else {
        this.peripheral.writeHandle(0x000c, new Buffer([0xcc, 0x24, 0x33]), true, function (error) {
            if (error) console.log('BLE: Write handle Error: ' + error);
            callback();
        });
    }
    this.ledsStatus.on = status;
};

MagicBlueBulb.prototype.getState = function(callback) {
    callback(null, this.ledsStatus.on);
};



MagicBlueBulb.prototype.getHue = function(callback) {
    callback(null, this.ledsStatus.values[0]);
};

MagicBlueBulb.prototype.setHue = function(level, callback) {
    this.ledsStatus.values[0] = level;
    if (this.ledsStatus.on) {
        this.writeColor(function() {
            callback();
        });
    } else {
        callback();
    }
};






MagicBlueBulb.prototype.getSat = function(callback) {
    callback(null, this.ledsStatus.values[1]);
};

MagicBlueBulb.prototype.setSat = function(level, callback) {
    this.ledsStatus.values[1] = level;
    if (this.ledsStatus.on) {
        this.writeColor(function() {
            callback();
        });
    } else {
        callback();
    }
};




MagicBlueBulb.prototype.getBright = function(callback) {
    callback(null, this.ledsStatus.values[2]);
};

MagicBlueBulb.prototype.setBright = function(level, callback) {
    this.ledsStatus.values[2] = level;
    if (this.ledsStatus.on) {
        this.writeColor(function() {
            callback();
        });
    } else {
        callback();
    }
};






MagicBlueBulb.prototype.getServices = function() {
    return [this.informationService, this.service];
};
