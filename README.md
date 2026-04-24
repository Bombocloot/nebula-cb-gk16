# Nebula — Cosmic Byte CB-GK-16 Firefly RGB Controller

![Nebula](https://img.shields.io/badge/Cosmic%20Byte-CB--GK--16-00FFFF)
![Platform](https://img.shields.io/badge/Platform-Windows-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Status](https://img.shields.io/badge/Top%20Rows-Help%20Wanted-red)

**Nebula** is an open-source RGB controller for the **Cosmic Byte CB-GK-16 Firefly** keyboard, built by reverse-engineering the USB HID protocol. The bottom 2 rows work fully with animations. We are currently trying to unlock the top 4 rows and would love community help.

---

## 🆘 Help Wanted: Full-Matrix LED Control (Top 4 Rows)

> **This is the main open problem.** If you know Holtek HT68FB571 / EVision VS11K09A firmware protocols, USB HID reverse engineering, or have a CB-GK-16 / Firefly keyboard — please read the [Protocol Research](#-protocol-research--current-blockers) section and open an issue!

---

## ✨ What Works Right Now

| Feature | Status |
|---|---|
| Per-key RGB on bottom 2 rows (Shift + Ctrl rows) | ✅ Working |
| Smooth animations (rainbow wave, gradient, reactive) | ✅ Working |
| ~15 FPS sustained animation without EEPROM writes | ✅ Working |
| App UI with presets, per-key picker, brightness | ✅ Working |
| Top 4 rows (Fn, numbers, QWERTY, Home row) | ❌ Not working yet |

---

## 🔧 Installation

### Prerequisites: Install libusbK Driver

Nebula requires the **libusbK** driver on Interface 2 (MI_02). The default Windows HID driver won't work.

1. **Download [Zadig](https://zadig.akeo.ie/)** and run it
2. Plug in your **CB-GK-16 Firefly**
3. Go to **Options → List All Devices**
4. Find **"HID-compliant vendor-defined device"** with **`MI_02`** in its path (`04D9 A1CD`)
5. Set target driver to **libusbK (v3.1.0.0)** and click **Replace Driver**

> To revert for the official Firefly software: re-run Zadig, pick the same device, choose `HidUsb`, click Replace Driver.

### From Source

```bash
git clone https://github.com/Bombocloot/nebula-cb-gk16.git
cd nebula-cb-gk16
npm install
npm start
```

---

## 🔬 Protocol Research & Current Blockers

This section documents everything found so far through reverse engineering. **Please read if you want to help.**

### Hardware

- **MCU:** Holtek HT68FB571 / EVision VS11K09A-1
- **VID/PID:** `04D9:A1CD`
- **USB Interfaces:**

| Interface | Usage Page | Driver | Role |
|---|---|---|---|
| MI_00 | 0x01 / Generic Desktop | HID | Standard keyboard input |
| MI_01 Col01 | 0xFF02 / Vendor | HID (input only, no OUT EP) | Unknown |
| MI_01 Col02 | 0x0C / Consumer | HID | Media keys |
| MI_02 | 0xFF00 / Vendor | **libusbK** | RGB control ← we use this |
| MI_03 | 0x01 / Generic Desktop | HID | Mouse / extra HID |

### Protocol — What We Know

All communication goes through **Interface 2 (MI_02)** via:
- **Feature Reports** (8 bytes) — `USB_HOST → keyboard` control transfers: `bmRequestType=0x21, bRequest=0x09, wValue=0x0300, wIndex=2`
- **Interrupt OUT** (64 bytes) — bulk data writes to the OUT endpoint

#### Command Reference

| Command | Bytes | Effect |
|---|---|---|
| `0x30` | `[0x30,0,0,0,0, 0x55,0xAA,0]` | Unlock / session init. Required before RGB writes. |
| `0x12` | `[0x12,0,0,ch,0, 0x55,0xAA,0]` | Planar channel write. ch=0 flags, ch=1 R, ch=2 G, ch=3 B. Followed by two 64-byte payloads (128 bytes total). |
| `0x08` | `[0x08,0x33,0x3f,0x04,0,0,0xC4,0x3B]` | Set mode 51 (per-key custom). |
| `0x0C` | `[0x0C,0,0,0,0, 0x55,0xAA,0]` + 128 zero bytes | EEPROM finalize (commits to flash). |
| `0x0D` | `[0x0D,0,0,0,0, 0x55,0xAA,0]` + 128 zero bytes | EEPROM finalize (commits to flash). |
| `0x04` | `[0x04, keyIndex, r, g, b, 0, 0, 0]` | Per-key direct write (6-bit RGB). Does NOT require unlock. Keyboard reverts to firmware mode after ~5s with no updates. |

#### RGB Encoding

- **Scale:** 0–255 → 0–63 (6-bit). Formula: `Math.round((v/255)*63)`
- **Planar format:** Separate arrays for flags, R, G, B — each 128 bytes
- **Flag byte:** `0x10` = key enabled, `0x00` = off
- **Palette:** 7-color preset (21 bytes) sent after 0x30 unlock

#### Fastest Known Frame Sequence (no EEPROM, ~15 FPS)

```
feat([0x30, 0, 0, 0, 0, 0x55, 0xAA, 0])   // unlock (once per session)
bulk(palette)                               // 21-byte palette (once per session)
feat([0x12, 0, 0, 0, 0, 0x55, 0xAA, 0])   // flags channel (once per session)
bulk(flags[0..63])
bulk(flags[64..127])
feat([0x08, 0x33, 0x3f, 0x04, 0, 0, 0xC4, 0x3B])  // mode (once per session)

// Per frame (3 channels × 2 bulk = 6 transfers + 3 feature reports):
feat([0x12, 0, 0, 1, 0, 0x55, 0xAA, 0])
bulk(R[0..63]); bulk(R[64..127])
feat([0x12, 0, 0, 2, 0, 0x55, 0xAA, 0])
bulk(G[0..63]); bulk(G[64..127])
feat([0x12, 0, 0, 3, 0, 0x55, 0xAA, 0])
bulk(B[0..63]); bulk(B[64..127])
```

Skipping `0x0C`/`0x0D` avoids EEPROM commits → achieves **~15 FPS** with no flash wear.

---

### ❌ The Main Blocker: Top 4 Rows Don't Light Up

The keyboard has 6 physical rows:

```
Row 0: ESC  F1  F2  F3  F4  F5  F6  F7  F8  F9  F10  F11  F12  PrtSc  ScrLk  Pause
Row 1: `    1   2   3   4   5   6   7   8   9   0   -   =   Backspace  Ins  Home
Row 2: Tab  Q   W   E   R   T   Y   U   I   O   P   [   ]   \          Del  End
Row 3: Caps A   S   D   F   G   H   J   K   L   ;   '   Enter          PgUp PgDn
Row 4: LShift  Z  X  C  V  B  N  M  ,  .  /  RShift           Up
Row 5: LCtrl  Win  LAlt       Space       RAlt  Fn  Menu  RCtrl   Left  Down  Right
```

**Rows 4 and 5 (bottom 2) light up correctly via the `0x12` planar protocol.**  
**Rows 0–3 (top 4) never respond**, regardless of which indices we write.

### What We've Tried

| Experiment | Result |
|---|---|
| 0x12 planar write, all 128 indices, all colors | Only rows 4-5 light |
| 0x04 per-key direct, indices 0–95 | Nothing changed (no freeze) |
| 0x0C/0x0D with non-zero data (flag bytes) | Keyboard froze/crashed |
| 0x0C/0x0D with all 0x3F | Bottom 2 rows changed color |
| byte[4]=0x01 (page select attempt) | No effect |
| HID via Interface 1 (node-hid) | Interface 1 has no OUT endpoint — input only |
| Launching OEM FIREFLY.exe | OEM software can't communicate (libusbK blocks HID driver) |
| 8-variant protocol sweep (0x04, 0x11, 0x0C w/ channel data, page variants) | None unlocked top rows |

### What the OEM Software Does Differently

The official **FIREFLY.exe** uses a config file (`p1.bin`) with packed `[flag, R, G, B]` per key (512 bytes for 128 keys). When you click "Apply" in the OEM software, it:
1. Writes the full color map to `p1.bin`
2. Triggers an internal full-board EEPROM sync

The OEM software **successfully programs all 6 rows.** But with libusbK installed, FIREFLY.exe loses access to the keyboard (driver conflict). We believe FIREFLY.exe uses the same MI_02 interface but with a different command sequence that unlocks the full LED matrix.

### Key Index Map (Partial — Confirmed via `key-mapper.js`)

```
Index 0 = ESC     Index 1 = F1     Index 2 = F2     Index 3 = F3
Index 4 = F4      Index 5 = F5
```

These top-row keys were confirmed responsive via `0x04` but the LEDs didn't visibly change during testing. The full 128-index map is incomplete.

---

## 🙏 Can You Help?

We're stuck on unlocking the top 4 rows. If you can help with any of the following, please **open an issue** or **start a discussion**:

- **Do you own a CB-GK-16 / CB-GK-18 Firefly or any EVision/Holtek RGB keyboard?**
- **Do you know the Holtek HT68FB571 LED matrix protocol?** Specifically: what command/sequence addresses the upper LED banks?
- **Have you reverse-engineered EVision VS11K09A firmware?** We suspect there's a separate "page select" or "bank enable" command for the upper rows.
- **Can you capture OEM USB traffic?** If you have the keyboard with its original HID driver (not libusbK), a Wireshark/USBPcap capture of the OEM software setting a custom color would be invaluable.

### Suspected Root Cause

The LED matrix likely has two independently addressable banks:
- **Bank A (rows 4-5):** Addressed by current `0x12` planar writes
- **Bank B (rows 0-3):** Requires a different command prefix, page byte, or a separate unlock sequence

We believe finding the correct `0x0C`/`0x0D` payload format, or an undocumented bank-select command, would unlock the full keyboard.

---

## 🗂️ Research Files

| File | Purpose |
|---|---|
| `backend/perkey-rgb.js` | Main per-key RGB controller class |
| `backend/keyboard.js` | Full app keyboard integration + OEM applyCustom path |
| `backend/protocol-sweep.js` | 8-variant protocol sweep (run to test new hypotheses) |
| `backend/key-mapper.js` | Light one key at a time to map index → physical key |
| `backend/ram-fast.js` | Optimized no-EEPROM frame loop, FPS benchmark |
| `backend/ram-test-nofinalize.js` | Tests with/without finalize for display vs EEPROM |
| `backend/hid-test.js` | Test via Interface 1 HID path (confirmed input-only) |
| `backend/HOLTEK-PROTOCOL-REFERENCE.md` | Protocol notes and architecture reference |

---

## 🎮 Hardware Compatibility

| Model | VID | PID | Status |
|---|---|---|---|
| Cosmic Byte CB-GK-16 Firefly | 04D9 | A1CD | ⚠️ Bottom 2 rows working, top 4 in progress |
| Cosmic Byte CB-GK-18 | 04D9 | A1CD | ❓ Untested |

---

## 🛠️ Tech Stack

- **Electron** — Desktop app framework
- **usb (node-usb)** — USB control via libusbK
- **node-hid** — HID enumeration (driver probe)
- **Wireshark + USBPcap** — Traffic capture during research

---

## 📝 License

MIT — see [LICENSE](LICENSE)

---

## 🙏 Credits

- **Bombocloot** — Reverse engineering & development
- **OpenRGB Community** — Protocol research inspiration
- **Cosmic Byte** — For making affordable RGB keyboards

---

*Made with ⌨️ and way too many USB packet captures. Help us light up the whole keyboard!*
