const Module = require('node:module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id) {
    if (id === 'usb' || id === 'node-hid') {
        return {
            devices: () => [],
            HID: class { constructor() {} write() {} read() {} close() {} },
            findByIds: () => null
        };
    }
    return originalRequire.apply(this, arguments);
};
