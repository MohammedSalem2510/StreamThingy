import { DeskThing } from "@deskthing/server";
import { AppSettings, DESKTHING_EVENTS, SETTING_TYPES } from "@deskthing/types";
import { spawn } from "child_process";

/* ------------------------------------------------------------------ */
/*  Settings                                                           */
/* ------------------------------------------------------------------ */

const MODULES = 35;

const buildSettings = (): AppSettings => {
  const settings: AppSettings = {
    color: {
      label: "App Color",
      id: "color",
      type: SETTING_TYPES.COLOR,
      value: "#000000",
    },
    buttonColor: {
      label: "Button Color",
      id: "btnColor",
      type: SETTING_TYPES.COLOR,
      value: "#A7A6BA",
    },
  };

  settings["layout"] = {
    label: "Layout",
    id: "layout",
    type: SETTING_TYPES.SELECT,
    value: "default",
    options: [
      { label: "Default (5x3, fixed size)", value: "default" },
      { label: "Scaled (5x3, fills screen)", value: "scaled" },
      { label: "Extended (7x5, 35 buttons)", value: "extended" },
    ],
  };

  for (let i = 1; i <= MODULES; i++) {
    settings[`icon${i}`] = {
      label: `Module ${i} Icon`,
      id: `icon${i}`,
      type: SETTING_TYPES.STRING,
      value: "",
    };
    settings[`action${i}`] = {
      label: `Module ${i} Action`,
      id: `act${i}`,
      type: SETTING_TYPES.STRING,
      value: "",
    };
  }

  return settings;
};

const start = async () => {
  console.log("Server Started!");
  DeskThing.initSettings(buildSettings());
};

const stop = async () => {
  console.log("Server Stopped");
};

DeskThing.on(DESKTHING_EVENTS.START, start);
DeskThing.on(DESKTHING_EVENTS.STOP, stop);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Logging must NEVER be able to break a button press.
 * DeskThing.sendLog does not exist on all server SDK versions, and an
 * exception here aborts the whole action handler before the spawn runs.
 */
const log = (msg: string) => {
  try {
    const dt = DeskThing as unknown as Record<string, unknown>;
    if (typeof dt.sendLog === "function") {
      (dt.sendLog as (m: string) => void)(msg);
      return;
    }
    if (typeof dt.log === "function") {
      (dt.log as (lvl: string, m: string) => void)("log", msg);
      return;
    }
  } catch {
    /* ignore */
  }
  console.log(msg);
};

const IS_WIN = process.platform === "win32";
const IS_MAC = process.platform === "darwin";
const IS_LINUX = process.platform === "linux";

/**
 * Linux GUI apps launched from a background service often have no display
 * context. These are only injected on Linux so Windows/macOS are unaffected.
 */
const guiEnv = () =>
  IS_LINUX
    ? {
        ...process.env,
        WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY ?? "wayland-0",
        XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR ?? "/run/user/1000",
        DISPLAY: process.env.DISPLAY ?? ":0",
      }
    : process.env;

/** Fire and forget. shell:true is what makes arguments work. */
const run = (command: string) => {
  try {
    const child = spawn(command, [], {
      shell: true,
      detached: !IS_WIN,
      stdio: "ignore",
      windowsHide: true,
      env: guiEnv(),
    });
    child.on("error", (err) => log(`spawn failed: ${err.message}`));
    child.unref();
  } catch (err) {
    log(`spawn threw: ${String(err)}`);
  }
};

/** control+shift+p  ->  ^+p   (Windows SendKeys syntax) */
const toSendKeys = (combo: string): string => {
  const parts = combo.split("+").map((p) => p.trim().toLowerCase());
  const key = parts.pop() ?? "";
  const named: Record<string, string> = {
    enter: "{ENTER}", tab: "{TAB}", esc: "{ESC}", escape: "{ESC}",
    space: " ", backspace: "{BACKSPACE}", delete: "{DELETE}",
    up: "{UP}", down: "{DOWN}", left: "{LEFT}", right: "{RIGHT}",
    home: "{HOME}", end: "{END}", pgup: "{PGUP}", pgdn: "{PGDN}",
  };
  const body = named[key] ?? (/^f\d{1,2}$/.test(key) ? `{${key.toUpperCase()}}` : key);
  const mods = parts
    .map((m) =>
      m === "ctrl" || m === "control" ? "^" :
      m === "alt" ? "%" :
      m === "shift" ? "+" : ""
    )
    .join("");
  return mods + body;
};

/** control+shift+p  ->  keystroke "p" using {command down, shift down} */
const toAppleScript = (combo: string): string => {
  const parts = combo.split("+").map((p) => p.trim().toLowerCase());
  const key = parts.pop() ?? "";
  const mods = parts
    .map((m) =>
      m === "cmd" || m === "command" ? "command down" :
      m === "ctrl" || m === "control" ? "control down" :
      m === "alt" || m === "option" ? "option down" :
      m === "shift" ? "shift down" : ""
    )
    .filter(Boolean);
  const using = mods.length ? ` using {${mods.join(", ")}}` : "";
  return `keystroke "${key}"${using}`;
};

/**
 * Sends a global keystroke to whatever window currently has focus.
 * Linux/X11 needs xdotool; Linux/Wayland needs ydotool or wtype
 * (swap the linux branch below if you are on Wayland).
 */
const sendKeys = (combo: string) => {
  if (IS_WIN) {
    const keys = toSendKeys(combo).replace(/'/g, "''");
    run(
      `powershell -NoProfile -WindowStyle Hidden -Command ` +
        `"Add-Type -AssemblyName System.Windows.Forms; ` +
        `[System.Windows.Forms.SendKeys]::SendWait('${keys}')"`
    );
  } else if (IS_MAC) {
    run(`osascript -e 'tell application "System Events" to ${toAppleScript(combo)}'`);
  } else {
    // X11:
    run(`xdotool key ${combo.split("+").map((p) => p.trim()).join("+")}`);
    // Wayland alternative:
    // run(`wtype -M ctrl -M shift p -m ctrl -m shift`)
  }
};

/** Open a URL or file with the OS default handler. */
const openTarget = (target: string) => {
  if (IS_WIN) run(`start "" "${target}"`);
  else if (IS_MAC) run(`open "${target}"`);
  else run(`xdg-open "${target}"`);
};

/* ------------------------------------------------------------------ */
/*  Action dispatch                                                    */
/* ------------------------------------------------------------------ */

DeskThing.on("action", (data) => {
  const instruction = String(data.payload ?? "").trim();
  if (!instruction) return;

  const index = instruction.indexOf(",");
  if (index === -1) {
    log(`Malformed action (missing comma): "${instruction}"`);
    return;
  }

  const type = instruction.slice(0, index).trim().toLowerCase();
  const command = instruction.slice(index + 1).trim();

  log(`StreamThingy action: [${type}] ${command}`);

  switch (type) {
    case "cmd":
      run(command);
      break;

    case "key":
      sendKeys(command);
      break;

    case "url":
    case "open":
      openTarget(command);
      break;

    default:
      log(`Unhandled action type: "${type}"`);
      break;
  }
});
