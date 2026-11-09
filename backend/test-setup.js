const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id) {
    if (id === 'usb' || id === 'node-hid') {
        return {
            getDeviceList: () => [],
            findByIds: () => null,
            devices: () => []
        };
    }
    return originalRequire.apply(this, arguments);
};
