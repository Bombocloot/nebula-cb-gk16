# How to Capture and Map More Keys

## Quick Method to Map Additional Keys

### Step 1: Set Known Keys in FIREFLY
1. Open FIREFLY software
2. Go to per-key color mode
3. Set SPECIFIC, EASILY IDENTIFIABLE keys to unique colors:
   - A = Red
   - 1 = Green  
   - Space = Blue
   - Enter = Yellow
   - Tab = Cyan

### Step 2: Start USB Capture
```powershell
# Open Wireshark
# Select USBPcap1 interface
# Start capture
```

### Step 3: Apply in FIREFLY
- Click "Sync" or "Apply" to send colors to keyboard
- Wait 2 seconds
- Stop Wireshark capture

### Step 4: Save Capture
- File → Save As → `specific-keys.pcapng`
- Save to Desktop

### Step 5: Extract Indices
```powershell
cd "C:\Program Files (x86)\Cosmic Byte\Firefly\Nebula"
node backend\extract-key-indices.js
```

This will show you which RGB index corresponds to each physical key!

## What We Know So Far

Confirmed mappings:
- Index 0 = ESC
- Index 1 = F1
- Index 2 = F2
- Index 3 = F3
- Index 4 = F4
- Index 5 = F5

Keys that work (indices unknown):
- A, E, N, K, P, =, +
- Scroll Lock, Both Ctrl
- Page Down, 5, F7
