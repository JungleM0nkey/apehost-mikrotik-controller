# Bridge Visualization - Before and After

## Previous Implementation (Flat Structure)

All interfaces were treated equally with no bridge hierarchy:

```
         [Router]
        /   |   \   \   \
       /    |    \   \   \
  [ether1][ether2][ether3][ether4][bridge1]
     |       |       |       |        |
   Hosts   Hosts   Hosts   Hosts    Hosts
```

**Problems:**
- No indication that ether2, ether3, ether4 are part of bridge1
- Confusing: Why are there hosts on both the physical ports AND the bridge?
- Can't tell network topology at a glance

## New Implementation (Hierarchical Structure)

Bridge interfaces act as containers for their member ports:

```
                    [Router]
                   /         \
                  /           \
            [bridge1]        [ether1]
           (3 ports)            |
          /    |    \         Hosts
         /     |     \
    [ether2][ether3][ether4]
       |       |       |
     Hosts   Hosts   Hosts
```

**Improvements:**
- Clear parent-child relationship (bridge → member ports)
- Visual distinction (dashed lines = membership, solid lines = connection)
- Bridge shows port count
- Hosts properly attributed to physical connection point

## Visual Styling Differences

### Bridge Node
- **Size:** Larger than regular interfaces (180px vs 140-160px)
- **Border:** Thicker (3px vs 2px)
- **Background:** Gradient effect
- **Label:** Shows port count "(3 ports)"

### Bridge Member Port Node
- **Size:** Smaller than bridge but normal size (140px)
- **Border:** Standard 2px
- **Connection:** Dashed line to parent bridge
- **Label:** Shows as regular interface

### Edge Styling
- **Bridge → Member Port:** Dashed line (strokeDasharray: '5,5')
- **Router → Interface:** Solid line
- **Interface → Host:** Thin solid line

## Example: Complex Network

Real-world example with multiple bridges and VLANs:

```
                         [Router]
                    /      |      \
                   /       |       \
            [bridge1]  [bridge2]  [ether5-wan]
           (LAN - 3)  (GUEST - 2)     |
           /  |  \      /    \      Internet
          /   |   \    /      \
    [ether1][ether2][ether3][ether4][wlan1]
       |      |      |      |        |
    Desktop  NAS   Switch  AP    Guest-WiFi
                     |            Devices
                   Switch
                   Ports
```

## Color Coding

- **Active Bridge:** Green border (var(--color-accent-success))
- **Inactive Bridge:** Gray border (var(--color-border-primary))
- **Bridge Member (Active):** Green border, smaller
- **Bridge Member (Inactive):** Gray border, smaller
- **Hosts (Reachable):** Green border
- **Hosts (Stale):** Orange border (var(--color-accent-primary))

## Data Flow

1. **Fetch Data:**
   - `/interface/print` → All interfaces (including bridges)
   - `/interface/bridge/port/print` → Bridge membership
   - `/ip/arp/print` → Connected hosts

2. **Process Relationships:**
   - Build map: physical interface → parent bridge
   - Build map: bridge → member ports
   - Identify standalone interfaces

3. **Render Hierarchy:**
   - Render bridge nodes with member count
   - Render member port nodes under bridges (dashed connections)
   - Render standalone interfaces directly under router
   - Attach hosts to their physical connection point

4. **Apply Layout:**
   - Layout algorithm positions all nodes
   - Hierarchy maintained regardless of layout type
   - Radial layout works particularly well for this structure
