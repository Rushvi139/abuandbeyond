# Connecting the kitchen printer

The ticket at `/kitchen/kot/[id]` prints through the browser's own print
system. That means **the printer has to be one the operating system knows
about** — it appears in the Windows/Android/macOS printer list. The web page
never talks to the printer directly.

Everything below follows from that one fact.

## Pick the connection first

| | Works? | Notes |
|---|---|---|
| **LAN / Wi-Fi** | Best | Add it once by IP. Any device in the kitchen can print to it — tablet, phone, the office laptop. Survives the tablet being replaced. |
| **USB** | Good | Plug into whatever runs the kitchen screen. One machine only, and that machine has to stay on. |
| **Bluetooth** | Usually not | See below. |

Buy **LAN** if you are buying. It is the difference between one printer the
whole kitchen shares and a printer tied to one tablet.

### Why Bluetooth usually fails

Most ₹2,000–4,000 Bluetooth thermal printers only expose a raw serial link
(SPP). There is no driver, so the OS never lists them as a printer, so the
browser cannot print to them. They only work from the vendor's own app.

Pairing them changes nothing. If your printer's box says "works with Android
printing" or it ships a Windows driver, it will work. If it only lists an app
name, it will not.

If you already own a Bluetooth-only printer, say so — the page can be taught to
speak ESC/POS to it directly over Web Bluetooth. That works on Android Chrome
and desktop Chrome, never on iPhone or iPad, and has to be re-connected by hand
each time the browser restarts. It is a workaround, not the plan.

## Setting it up

1. Connect the printer to the OS the normal way — add by IP for LAN, plug in
   for USB — and print the test page from the printer settings. **Do not open
   the app until that test page comes out.** If the OS can't print to it,
   neither can we.
2. Set it as the **default printer**. The browser prints to the default.
3. Open `/kitchen` on that device, sign in, and tap **Print KOT** on any order.
   A print dialog appears; choose the printer and print.
4. Check the paper. Width should be 80 mm with nothing cut off at the right.
   If it is wrong, tell me the printer model and what came out.

## Making it print without the dialog

Step 3 pops a dialog every time, which is no good mid-service. To print
silently, launch Chrome with kiosk printing. It then prints straight to the
default printer with no dialog.

**Windows** — edit the Chrome shortcut, set Target to:

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --kiosk https://abuandbeyond.in/kitchen
```

**Linux mini-PC**:

```sh
google-chrome --kiosk-printing --kiosk https://abuandbeyond.in/kitchen
```

Then turn on **Auto-print** on the kitchen screen, and every new paid order
prints by itself.

`--kiosk` also hides the address bar and tabs, which is what you want on a
screen in a kitchen. To get out, Alt+F4 (Windows) or Alt+Tab to another window.

## Which screen prints

Auto-print is **off by default and remembered per device**. A kitchen has one
printer and often several screens; if every tablet auto-printed you would get
four copies of every ticket. Turn it on only on the device wired to the
printer.

Two screens cannot double-print even if both are on: the first one to claim an
order wins, and the claim is recorded on the server. A refresh, a second tab,
or a tablet waking from sleep will not reprint a ticket that already came out.
**Re-print KOT** on the card is the deliberate way to get another copy.

## What hardware to buy

An 80 mm thermal receipt printer with an Ethernet port. In India the common
ones are Epson TM-T82, TVS RP 3200, Rugtek RP80, Posiflex. Any of them is
fine — this is a commodity.

Avoid 58 mm: the ticket is laid out for 80 mm, and 58 mm is too narrow to read
a dish name across the pass.

Run the kitchen screen on something that stays plugged in — a cheap Windows
mini-PC or an old laptop beats a tablet, because kiosk printing needs desktop
Chrome.

## If nothing prints

- **Blank paper** — almost always the wrong paper width or the roll in upside
  down. Thermal paper only prints on one side.
- **Dialog appears but no printer listed** — the OS doesn't have it. Go back to
  step 1; this is not an app problem.
- **Prints a cut-off right edge** — the printer is 58 mm, or its driver is set
  to 58 mm.
- **Nothing happens on tap** — the pop-up blocker. The ticket prints from a
  hidden frame on the same site, so allow pop-ups for abuandbeyond.in.
