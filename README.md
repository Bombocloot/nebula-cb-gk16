# Nebula - Cosmic Byte CB-GK-16 Firefly RGB Controller

![Nebula](https://img.shields.io/badge/Cosmic%20Byte-CB--GK--16-00FFFF)
![Platform](https://img.shields.io/badge/Platform-Windows-blue)
![License](https://img.shields.io/badge/License-MIT-green)

**Nebula** is a modern, open-source RGB controller for the **Cosmic Byte CB-GK-16 Firefly** mechanical keyboard. It provides per-key RGB control, smart lighting modes, and custom effects that the official software doesn't offer.

## ✨ Features

- 🎨 **Per-Key RGB Control** - Set individual colors for all 87 keys
- 🌈 **Presets** - Rainbow, Gradient, Gaming (WASD), Fill, Clear
- ⚡ **Smart Mode** - Auto-switch between idle/active effects with neighbor flash
- 🎚️ **Per-Key Brightness** - Control brightness by adjusting color intensity
- 💾 **EEPROM Persistence** - Colors saved to keyboard, survive power-off

## 📸 Screenshots

*Coming soon*

## 🔧 Installation

### From Release
1. Download the latest `.exe` from [Releases](../../releases)
2. Run the installer
3. Launch Nebula from Start Menu

### From Source
```bash
git clone https://github.com/Bombocloot/nebula-cb-gk16.git
cd nebula-cb-gk16
npm install
npm start
```

## 🎮 Supported Hardware

| Model | VID | PID | Status |
|-------|-----|-----|--------|
| Cosmic Byte CB-GK-16 Firefly | 04D9 | A1CD | ✅ Fully Supported |
| Cosmic Byte CB-GK-18 | 04D9 | A1CD | ⚠️ May work (untested) |

## 🔬 How It Was Made

This project was created through **reverse engineering** the USB HID protocol used by the Cosmic Byte Firefly keyboard.

### The Journey

1. **USB Capture** - Used Wireshark + USBPcap to capture traffic between the official Firefly software and the keyboard

2. **Protocol Analysis** - Analyzed hundreds of packets to identify:
   - Unlock command (0x30)
   - Planar RGB encoding (6-bit per channel)
   - 128-key matrix addressing
   - Mode selection (Mode 51 for custom)
   - EEPROM finalization sequence

3. **Key Mapping** - Manually tested all 128 indices to map physical keys to protocol addresses

4. **Direct Mode Research** - Extensive testing of alternative opcodes (0x27, 0x3B, 0xC0, etc.) to find RAM-based control. Result: **Not available on this firmware** - all commands write to EEPROM.

### Protocol Details

```
Unlock:    [0x30, 0x00, 0x00, 0x00, 0x00, 0x55, 0xAA, 0x00]
Apply:     [0x12, 0x00, 0x00, section, 0x00, 0x01, 0x00, 0x00]
           section 0 = flags, 1 = R, 2 = G, 3 = B
Mode:      [0x08, 0x02, 0x33, 0x00, 0x00, 0x00, 0x00, 0x00]
Finalize:  [0x0C, ...] + [0x0D, ...]

RGB Encoding: Planar (separate R, G, B arrays), 6-bit per channel (0-63)
```

### Technical Limitations

- **Update Rate**: ~5 FPS (EEPROM write bottleneck)
- **No Direct Mode**: Firmware doesn't expose RAM-based control
- **EEPROM Wear**: Heavy use could wear out flash memory (100K write cycles)

## 🛠️ Tech Stack

- **Electron** - Cross-platform desktop framework
- **node-hid** - USB HID communication
- **PowerShell** - Key monitoring (Windows)

## 📝 License

MIT License - see [LICENSE](LICENSE)

## 🙏 Credits

- **Bombocloot** - Reverse engineering & development
- **OpenRGB Community** - Protocol research inspiration
- **Cosmic Byte** - For making affordable RGB keyboards

---

*Made with ⌨️ and lots of USB packet captures*
