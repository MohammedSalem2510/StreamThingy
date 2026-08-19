
# StreamThingy

> **About this fork**
>
> This is a fork of [StreamThingy](https://github.com/JustAHippo/StreamThingy) adapted for **larger DeskThing clients** — tablets, Amazon Echo Show devices, and anything bigger than the Car Thing's 800×480 display, where the original's fixed 100px 5×3 grid only fills part of the screen. It adds:
>
> - **Three layout options:** the default 5×3 grid, a 5×3 grid scaled to fill the display, and a 7×5 grid with 35 buttons (the original 15 stay centred and unchanged; the new 20 fill the outer ring clockwise from the top-left).
> - **`cmd` actions with arguments.**
> - **New action types:** `key` (global keystroke), `url`, and `dt` (fires DeskThing actions, e.g. `dt,server,play` or `dt,discord,mute`).
> - **Windows and macOS support** alongside Linux.

Use your Spotify Car Thing similar to the base functionality of a StreamDeck within Desk Thing.![StreamThingy running with basic configuration](https://i.imgur.com/vhqGlRI.png)
## Compatibility
This app has only been tested on Arch Linux with Wayland. Mileage may vary on other distributions or operating systems

## Configuration
### Icons
Module Icons are loaded via URLs. If one fails to load, it may be unable to render on the Desk Thing.
### Actions
Action format goes as follows
``` 
type,action
```
#### Types of actions
|cmd  | (planned) key |
|--|--|
| Runs a command | Presses a keybind |
|cmd,/usr/bin/firefox |key,control+v|


for CMD, parameters will not function correctly. If a program requires parameters, create a shell script and execute it with a CMD action.

