const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(request) {
    if (request === 'usb') {
        return {
            findByIds: () => null,
            getDeviceList: () => []
        };
    }
    if (request === 'node-hid') {
        return {
            devices: () => [],
            HID: class {
                constructor() {}
                write() {}
                close() {}
            }
        };
    }
    return originalRequire.apply(this, arguments);
};
