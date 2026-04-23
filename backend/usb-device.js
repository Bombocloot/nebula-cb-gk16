const usb = require('usb');

const VID = 0x04D9, PID = 0xA1CD;
const INTERFACE_NUM = 2;

class USBDevice {
    constructor() {
        this.dev = null;
        this.iface = null;
        this.outEP = null;
    }

    connect() {
        if (this.dev) return true;
        try {
            this.dev = usb.findByIds(VID, PID);
            if (!this.dev) return false;
            this.dev.open();
            this.iface = this.dev.interface(INTERFACE_NUM);
            try { if (this.iface.isKernelDriverActive()) this.iface.detachKernelDriver(); } catch (_) {}
            this.iface.claim();
            this.outEP = this.iface.endpoints.find(e => e.direction === 'out');
            if (this.outEP) this.outEP.timeout = 2000;
            return true;
        } catch (e) {
            console.error('[USB] Connect error:', e.message);
            this.cleanup();
            return false;
        }
    }

    cleanup() {
        try { if (this.iface) this.iface.release(); } catch (_) {}
        try { if (this.dev) this.dev.close(); } catch (_) {}
        this.dev = null;
        this.iface = null;
        this.outEP = null;
    }

    close() {
        this.cleanup();
    }

    // Fire-and-forget feature report (8-byte command). Used by mode switching.
    sendFeatureReport(data) {
        if (!this.dev && !this.connect()) return;
        const buf = Buffer.alloc(8);
        for (let i = 0; i < Math.min(data.length, 8); i++) buf[i] = data[i];
        this.dev.controlTransfer(0x21, 0x09, 0x0300, INTERFACE_NUM, buf, err => {
            if (err) { this.cleanup(); }
        });
    }

    // Async interrupt OUT transfer (64-byte data). Used by per-key RGB protocol.
    write(data) {
        if (!this.dev && !this.connect()) throw new Error('Not connected');
        if (!this.outEP) throw new Error('No OUT endpoint');
        const buf = Buffer.alloc(64);
        for (let i = 0; i < Math.min(data.length, 64); i++) buf[i] = data[i];
        return new Promise((resolve, reject) => {
            this.outEP.transfer(buf, err => {
                if (err) { this.cleanup(); reject(err); }
                else resolve();
            });
        });
    }

    on(event, handler) {
        if (event === 'error') this._errorHandler = handler;
    }
}

module.exports = { USBDevice, VID, PID };
