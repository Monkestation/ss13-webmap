/**
 * Processes map files as specified in the provided webmap configuration.
 * For each map, generates a minimap using the dmm-tools utility.
 * Limits concurrent executions to improve performance and avoid resource exhaustion.
 *
 * @param {import('../src/typings/maps').MapConfig} webmapConfig - The configuration object describing map sets and their paths.
 * @returns {Promise<void>} Resolves when all maps have been processed.
 */
//
import { exec } from "node:child_process";
import path, { isAbsolute } from "node:path";
import fs from "node:fs/promises";

let optipng = false;
let pngcrush = false;

const taskLimit = process.env.TASK_LIMIT || 2;

console.info(
  `Generating maps with a task limit of ${taskLimit} (set via TASK_LIMIT env var)`,
);

let dmmTool = process.env.DMM_TOOL || "dmm-tools";

const execCommand = (command, cwd, log = true) => {
  let realCwd = cwd;
  if (!cwd) {
    realCwd = process.cwd();
  }
  return new Promise((resolve, reject) => {
    log && console.log(`Executing: ${command} in ${realCwd}`);
    exec(command, { cwd: realCwd }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing: ${command}\n${stderr}`);
        reject(error);
      } else {
        log && console.log(`Completed: ${command}`);
        resolve(stdout);
      }
    });
  });
};

const runLimited = async (tasks, limit) => {
  const results = [];
  const executing = new Set();

  for (const task of tasks) {
    const p = task().then((res) => {
      executing.delete(p);
      return res;
    });
    results.push(p);
    executing.add(p);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
};
/**
 *
 * @param {string} fullDmmPath
 * @param {string} cwd
 * @returns {}
 */
async function getZLevelCount(fullDmmPath, cwd) {
  try {
    const stdout = await execCommand(
      `${dmmTool} map-info "${fullDmmPath}"`,
      cwd,
      false,
    );
    const match = stdout.match(/"size":\[\d+,\d+,(\d+)\]/);
    return match ? Number.parseInt(match[1], 10) : 1;
  } catch (e) {
    console.warn(`Failed to get Z-levels for ${fullDmmPath}`, e);
    return 1;
  }
}

/**
 *
 * @param {string} outDir
 * @param {string} mapName
 * @param {number} zLevels
 * @returns {Promise<true | false | string[]>}
 */
async function shouldRenderMap(outDir, mapName, zLevels) {
  for (let i = 0; i < zLevels; i++) {
    const filePath = path.join(outDir, `${mapName}-${i}.png`);
    try {
      await fs.access(filePath);
    } catch {
      return true; // file missing
    }
  }
  return false;
}
/**
 *
 * @param {string} dmmPath
 * @param {string} outDir
 * @returns {Promise<void>}
 */
function getMapInfoTask(dmmPath, outDir) {
  return async () => {
    const mapInfoRaw = await execCommand(
      `${dmmTool} map-info "${dmmPath}"`,
      undefined,
      false,
    );
    const mapInfo = JSON.parse(mapInfoRaw);
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(
      path.join(outDir, "mapinfo.json"),
      JSON.stringify(Object.values(mapInfo)[0]),
      "utf-8",
    );
  }
}
/**
 *
 * @param {import('../src/typings/maps').MapConfig} webmapConfig
 */
const processMaps = async (webmapConfig) => {
  const tasks = [];
  const optipngParam = optipng ? " --optipng" : "";
  const pngcrushParam = pngcrush ? " --pngcrush" : "";

  const additionalParams = `${optipngParam}${pngcrushParam}`;

  console.log("Processing and calculating map Z-levels");
  for (const category of webmapConfig.categories) {
    for (const sub of category.subcategories ?? []) {
      for (const map of sub.maps ?? []) {
        const effectiveSupportsPipes =
          map.supportsPipes ??
          sub.supportsPipes ??
          category.supportsPipes ??
          true;
        const effectiveRenderOnce =
          map.renderOnce ?? sub.renderOnce ?? category.renderOnce ?? false;

        const fullDmmPath = map.dmmPath.startsWith("/")
          ? map.dmmPath
          : path.join(category.gamePath, category.mapFilesPath, map.dmmPath);

        const envFileParam = category.envFile
          ? ` -e ${path.join(category.gamePath, category.envFile)}`
          : "";
        const outDir = path.join(
          process.cwd(),
          "maps",
          category.name,
          sub.name,
          map.name,
        );
        const zLevels = getZLevelCount(fullDmmPath);

        const renderCheck = await shouldRenderMap(outDir, path.basename(fullDmmPath), zLevels);

        if (!effectiveRenderOnce || !!renderCheck) {
          const command = `${dmmTool}${envFileParam} minimap "${fullDmmPath}" -o "${outDir}"${additionalParams}`;
          tasks.push(() => execCommand(command, category.gamePath));
          tasks.push(getMapInfoTask(fullDmmPath, outDir));

          if (effectiveSupportsPipes) {
            const pipeDir = path.join(
              process.cwd(),
              "maps",
              category.name,
              sub.name,
              "pipes",
              map.name,
            );
            const pipeCommand = `${dmmTool}${envFileParam} minimap --enable only-wires-and-pipes "${fullDmmPath}" -o "${pipeDir}"${additionalParams}`;
            tasks.push(() => execCommand(pipeCommand, category.gamePath));
          }
        }
      }
    }

    for (const map of category.maps ?? []) {
      const effectiveSupportsPipes =
        map.supportsPipes ?? category.supportsPipes ?? true;
      const effectiveRenderOnce =
        map.renderOnce ?? category.renderOnce ?? false;

      const fullDmmPath = map.dmmPath.startsWith("/")
        ? map.dmmPath
        : path.join(category.gamePath, category.mapFilesPath, map.dmmPath);

      const envFileParam = category.envFile
        ? ` -e ${path.join(category.gamePath, category.envFile)}`
        : "";
      const outDir = path.join(process.cwd(), "maps", category.name, map.name);
      const zLevels = getZLevelCount(fullDmmPath);

      const renderCheck = await shouldRenderMap(outDir, path.basename(fullDmmPath), zLevels);

      if (!effectiveRenderOnce || !!renderCheck) {
        const command = `${dmmTool}${envFileParam} minimap "${fullDmmPath}" -o "${outDir}"${additionalParams}`;
        tasks.push(() => execCommand(command, category.gamePath));
        tasks.push(getMapInfoTask(fullDmmPath, outDir));
      }

      if (effectiveSupportsPipes) {
        const pipeDir = path.join(
          process.cwd(),
          "maps",
          category.name,
          "pipes",
          map.name,
        );
        const pipeCommand = `${dmmTool}${envFileParam} minimap --enable only-wires-and-pipes "${fullDmmPath}" -o "${pipeDir}${additionalParams}"`;
        tasks.push(() => execCommand(pipeCommand, category.gamePath));
      }
    }
  }

  try {
    await runLimited(tasks, taskLimit);
  } catch (error) {
    console.error("Error during map processing:", error);
  }

  console.log("All maps processed successfully.");
};

async function detectOptiPNG() {
  try {
    await execCommand("optipng -v", undefined, false);
    console.log("OptiPNG detected.");
    return true;
  } catch (error) {
    console.log("OptiPNG not detected.");
    return false;
  }
}

async function detectPNGCrush() {
  try {
    await execCommand("pngcrush -version", undefined, false);
    console.log("PngCrush detected.");
    return true;
  } catch (error) {
    console.log("PngCrush not detected.");
    return false;
  }
}

const main = async () => {
  let dmmToolPath;

  if (process.env.DMM_TOOL) {
    dmmToolPath = process.env.DMM_TOOL;
  } else {
    dmmToolPath = path.join(process.cwd(), dmmTool);
  }

  if (process.platform === "win32" && !dmmToolPath.endsWith(".exe")) {
    dmmToolPath += ".exe";
  }

  if (!isAbsolute(dmmToolPath)) {
    try {
      await execCommand(dmmToolPath, __dirname);
    } catch (error) {
      console.error("DMM Tool not found.");
      return;
    }
  }

  dmmTool = dmmToolPath;
  console.log(`Using DMM Tool: ${dmmTool}`);

  optipng = process.env.USE_OPTIPNG && detectOptiPNG();
  pngcrush = process.env.USE_PNGCRUSH && detectPNGCrush();

  const mapConfigPath = path.join(process.cwd(), "config.json");
  const mapConfig = JSON.parse(await fs.readFile(mapConfigPath, "utf-8"));
  try {
    await processMaps(mapConfig);
    console.log("Map generation completed.");
  } catch (error) {
    console.error("Error during map generation:", error);
  }
};

main();
