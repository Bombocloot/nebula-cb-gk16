const Module = require('node:module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
    if (id === 'usb') return { findByIds: () => null, getDeviceList: () => [], on: () => {}, removeListener: () => {} };
    if (id === 'node-hid') return { devices: () => [], HID: class { on() {} write() {} close() {} } };
    return originalRequire.apply(this, arguments);
};
