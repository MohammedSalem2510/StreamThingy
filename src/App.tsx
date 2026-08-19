import React, { useEffect, useState } from "react";
import { DeskThing } from "@deskthing/client";
import { AppSettings, DEVICE_CLIENT } from "@deskthing/types";

const MODULES = 35;
const BUILD = "0.11.12";

/**
 * Settings have arrived in different shapes across DeskThing versions:
 * keyed by the object key ("action1"), keyed by the setting id ("act1"),
 * or as a plain array. Resolve against all of them rather than assuming.
 */
const readSetting = (settings: unknown, keys: string[]): string => {
  if (!settings) return "";

  if (!Array.isArray(settings)) {
    const obj = settings as Record<string, { id?: string; value?: unknown }>;
    for (const k of keys) {
      const v = obj[k]?.value;
      if (typeof v === "string" && v.length) return v;
    }
  }

  const values = Array.isArray(settings)
    ? (settings as { id?: string; value?: unknown }[])
    : Object.values(settings as Record<string, { id?: string; value?: unknown }>);

  for (const entry of values) {
    if (entry && typeof entry.id === "string" && keys.includes(entry.id)) {
      const v = entry.value;
      if (typeof v === "string" && v.length) return v;
    }
  }

  return "";
};

/**
 * Loads the URL directly first (the display has its own network access),
 * falling back to DeskThing's /proxy/v1 only if that fails. A tile that
 * failed both shows a "?" so it is distinguishable from an unconfigured one.
 */
const IconTile: React.FC<{ url: string }> = ({ url }) => {
  const [src, setSrc] = useState(url);
  const [stage, setStage] = useState<"direct" | "proxy" | "failed">("direct");

  useEffect(() => {
    setSrc(url);
    setStage("direct");
  }, [url]);

  if (!url) return <div />;

  if (stage === "failed") {
    return <span style={{ color: "#fff", fontSize: 28, opacity: 0.5 }}>?</span>;
  }

  return (
    <img
      src={src}
      style={{ width: "80%", height: "80%", objectFit: "contain" }}
      onError={() => {
        if (stage === "direct") {
          setStage("proxy");
          setSrc(DeskThing.useProxy(url));
        } else {
          console.warn("Icon failed direct AND proxy:", url);
          setStage("failed");
        }
      }}
    />
  );
};

/**
 * Grid placement.
 *
 * In "extended" (7x5) the original 15 modules keep their 5x3 arrangement,
 * centred, so an existing deck looks identical after switching layouts.
 * Modules 16-35 fill the outer ring clockwise from the top-left corner.
 */
const ringCells = (): [number, number][] => {
  const cells: [number, number][] = [];
  for (let c = 1; c <= 7; c++) cells.push([1, c]);   // top row, left to right
  for (let r = 2; r <= 5; r++) cells.push([r, 7]);   // right column, down
  for (let c = 6; c >= 1; c--) cells.push([5, c]);   // bottom row, right to left
  for (let r = 4; r >= 2; r--) cells.push([r, 1]);   // left column, up
  return cells;
};

const placeModule = (n: number, extended: boolean): { row: number; col: number } => {
  if (!extended) {
    return { row: Math.floor((n - 1) / 5) + 1, col: ((n - 1) % 5) + 1 };
  }
  if (n <= 15) {
    return { row: Math.floor((n - 1) / 5) + 2, col: ((n - 1) % 5) + 2 };
  }
  const [row, col] = ringCells()[n - 16];
  return { row, col };
};

const App: React.FC = () => {

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [icons, setIcons] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [backgroundColor, setBackgroundColor] = useState<string>("#000000");
  const [iconColor, setIconColor] = useState<string>("#A7A6BA");

  useEffect(() => {
    async function initialize() {
      const loaded = await DeskThing.getSettings();
      console.log("StreamThingy settings payload:", loaded);
      if (loaded) setSettings(loaded);
    }
    initialize();

    const removeListener = DeskThing.on(DEVICE_CLIENT.SETTINGS, (data) => {
      if (data.payload) setSettings(data.payload as AppSettings);
    });

    return () => removeListener();
  }, []);

  useEffect(() => {
    if (!settings) return;

    const iconList: string[] = [];
    const actionList: string[] = [];

    for (let i = 1; i <= MODULES; i++) {
      iconList.push(readSetting(settings, [`icon${i}`]));
      actionList.push(readSetting(settings, [`action${i}`, `act${i}`]));
    }

    console.log("StreamThingy icons resolved:", iconList);
    console.log("StreamThingy actions resolved:", actionList);

    setIcons(iconList);
    setActions(actionList);
    setBackgroundColor(readSetting(settings, ["color"]) || "#000000");
    setIconColor(readSetting(settings, ["buttonColor", "btnColor"]) || "#A7A6BA");
  }, [settings]);

  function requestAction(index: number) {
    const action = (actions[index - 1] ?? "").trim();
    if (!action) return;

    if (action.toLowerCase().startsWith("dt,")) {
      const [, source, id, ...rest] = action.split(",").map((p) => p.trim());
      if (!source || !id) return;
      DeskThing.triggerAction({ id, source, value: rest.length ? rest.join(",") : undefined });
      return;
    }

    DeskThing.send({ type: "action", payload: action });
  }

  // Layout: default = original fixed 5x3; scaled = 5x3 filling the screen;
  // extended = 7x5 at the original tile size.
  const layout = readSetting(settings ?? {}, ["layout"]) || "default";

  let cols = 5;
  let rows = 3;
  let visible = 15;
  let cell = "100px";

  if (layout === "scaled") {
    cell = "min(calc((100vw - 80px) / 5), calc((100vh - 60px) / 3))";
  } else if (layout === "extended") {
    cols = 7;
    rows = 5;
    visible = 35;
  }

  const buttons = Array.from({ length: visible }, (_, i) => i + 1);

  if (!settings) {
    return <p className="text-white text-2xl">Loading settings... (build {BUILD})</p>;
  }

  return (
    <div
      style={{ backgroundColor, position: "relative" }}
      className="gap-2 flex-col w-screen h-screen flex justify-center items-center"
    >
      <div
        className="table-container"
        style={{
          gridTemplateColumns: `repeat(${cols}, ${cell})`,
          gridTemplateRows: `repeat(${rows}, ${cell})`,
        }}
      >
        {buttons.map((num) => (
          <button
            key={num}
            className="box"
            style={{
              backgroundColor: iconColor,
              gridRow: placeModule(num, layout === "extended").row,
              gridColumn: placeModule(num, layout === "extended").col,
            }}
            onClick={() => requestAction(num)}
          >
            <IconTile url={icons[num - 1] ?? ""} />
          </button>
        ))}
      </div>
      <span
        style={{
          position: "absolute",
          bottom: 4,
          right: 8,
          fontSize: 11,
          color: "#ffffff",
          opacity: 0.35,
        }}
      >
        v{BUILD}
      </span>
    </div>
  );
};

export default App;
