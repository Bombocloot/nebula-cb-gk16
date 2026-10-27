const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (path) {
    if (path === 'usb') {
        return {
            usb: {
                findByIds: () => null,
                getDeviceList: () => [],
                on: () => {}
            }
        };
    }
    if (path === 'node-hid') {
        return {
            devices: () => []
        };
    }
    return originalRequire.apply(this, arguments);
};
