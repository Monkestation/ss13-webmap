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

const taskLimit = process.env.TASK_LIMIT || 2;

console.info(`Generating maps with a task limit of ${taskLimit} (set via TASK_LIMIT env var)`);
// const dmmTool = `"D:\\WEBSITE_RELATIONS\\map_renderer\\dmm-tools.exe"`;
let dmmTool = process.env.DMM_TOOL || "dmm-tools";

const execCommand = (command, cwd) => {
  let realCwd = cwd;
  if (!cwd) {
    realCwd = process.cwd();
  }
  return new Promise((resolve, reject) => {
    console.log(`Executing: ${command} in ${realCwd}`);
    exec(command, { cwd: realCwd }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing: ${command}\n${stderr}`);
        reject(error);
      } else {
        console.log(`Completed: ${command}`);
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
 * @param {import('../src/typings/maps').MapConfig} webmapConfig
 */
const processMaps = async (webmapConfig) => {
  const tasks = [];

  for (const category of webmapConfig.categories) {
    for (const map of category.maps) {
      let fullDmmPath;
      if (map.dmmPath.startsWith("/"))
        fullDmmPath = map.dmmPath;
      else fullDmmPath = path.join(category.gamePath, category.mapFilesPath, map.dmmPath);

      const command = `${dmmTool} minimap ${fullDmmPath}`;
      tasks.push(() => execCommand(command, category.gamePath));

      if ((map.supportsPipes !== undefined && map.supportsPipes) || map.supportsPipes === undefined) {
        const pipeCommand = `${dmmTool} minimap --enable only-wires-and-pipes ${fullDmmPath} -o data/minimaps/pipes`;
        tasks.push(() => execCommand(pipeCommand, category.gamePath));
      }
    }
  }

  try {
    await runLimited(tasks, taskLimit);
  } catch (error) {
    console.error("Error during map processing:", error);
  }

  console.log("Copying minimaps to data/minimaps folder...");

  const copiedFolders = new Set();
  for (const category of webmapConfig.categories) {
    const minimapPath = path.join(category.gamePath, "data", "minimaps");
    const destPath = path.join(process.cwd(), "maps", category.name);
    const categoryName = category.name;
    if (copiedFolders.has(categoryName)) {
      console.log(`Already copied minimaps for ${categoryName}, skipping...`);
      continue;
    }
    copiedFolders.add(categoryName);
    console.log(`Copying minimaps for ${categoryName}...`);
    await fs.mkdir(destPath, { recursive: true });
    await fs.cp(minimapPath, destPath, { recursive: true });
  }
  console.log("All maps processed successfully.");
};

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

  const mapConfigPath = path.join(process.cwd(), "config.json");
  const mapConfig = JSON.parse(await fs.readFile(mapConfigPath, "utf-8"));
  try {
    await processMaps(mapConfig);
    console.log("Map generation completed.");
  } catch (error) {
    console.error("Error during map generation:", error);
  }
}

main();
