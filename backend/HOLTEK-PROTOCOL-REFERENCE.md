# Holtek RGB Protocol Technical Reference
# Cosmic Byte CB-GK-16 Firefly Keyboard

## Hardware Architecture

### MCU: Holtek HT68FB571 / EVision VS11K09A
- Integrated USB 2.0 Full-Speed (12 Mbps)
- Hardware LED PWM Engine (up to 128 LEDs)
- Matrix Scanning Logic (time-division multiplexed)

### USB Composite Device Topology
| Interface | Usage Page | Usage ID | Function |
|-----------|------------|----------|----------|
| 0 | 0x01 (Generic Desktop) | 0x06 (Keyboard) | Standard Typing |
| 1 | 0x0C (Consumer) | 0x01 (Consumer Control) | Media Keys |
| 2 | 0xFF00 (Vendor-Defined) | 0x01 | **RGB Control** |

### Key Constants
- VID: 0x04D9 (Holtek)
- PID: 0xA1CD (Firefly variant)
- Report Size: 64 bytes
- Keys per Packet: ~20 (with headers)
- Total Keys: 87 (TKL) but controller supports 104

## Protocol Structure

### Direct Mode Handshake
Before streaming, send SET_FEATURE to enter "Software Control":
```
[0x04, 0x01, 0x00, 0x00, ...] -> Enable Direct Mode
```

### Packet Fragmentation
- Data Volume: 104 keys × 3 bytes = 312 bytes
- Packets Needed: 312 / ~60 = 5-6 packets per frame
- Sequence Byte: 2nd or 3rd byte indicates bank (0, 1, 2...)

### Encoding Types
1. **Per-Channel (Planar)**: R-R-R..., G-G-G..., B-B-B...
2. **Per-LED (Interleaved)**: RGB-RGB-RGB...

### Checksum Algorithm
- Per-Packet: Sum(Bytes 0..62) % 256
- Last byte of each packet

## Matrix "Snaking" Topology

The LED matrix does NOT follow physical layout:
- Row 0: ESC, F1, F2... but also Scroll Lock, Pause
- Row 1: ~, 1, 2... may run Right-to-Left
- Ghost Keys: Indices 88-104 are NumPad (not present on TKL)

## Keep-Alive Requirement

If no data received for >5 seconds, firmware reverts to Rainbow Wave.
Send heartbeat packet every 1 second to maintain Direct Mode.

## Recovery Commands
- Fn + ESC (3 sec): Factory reset
- Reset packet: [0x07] or [0x04, 0xFF]
- ISP Mode Warning: Avoid 0x55 0xAA sequences (Flash Unlock)
