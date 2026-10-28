const Module = require('node:module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id) {
  if (id === 'usb') {
    return {
      getDeviceList: () => [],
      findByIds: () => null,
      on: () => {},
      removeListener: () => {}
    };
  }
  if (id === 'node-hid') {
    return {
      devices: () => []
    };
  }
  return originalRequire.apply(this, arguments);
};
