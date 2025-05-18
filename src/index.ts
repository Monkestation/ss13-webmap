import Fastify from "fastify";
import pointOfView from "@fastify/view";
import fastifyStatic from "@fastify/static";
import { Liquid } from "liquidjs";
import path from "node:path";
import type { MapConfig } from "typings/maps";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import { watch as fswatch } from "node:fs";
import { logger } from "./logger";

let config = JSON.parse(fsSync.readFileSync(path.join(process.cwd(), "config.json"), "utf-8")) as MapConfig;

const MAPS_PATH = path.join(process.cwd(), "maps");

const app = Fastify({ loggerInstance: logger });

app.register(fastifyStatic, {
  root: path.join(process.cwd(), "src", "public"),
  prefix: "/",
});

app.register(fastifyStatic, {
  root: path.join(process.cwd(), "maps"),
  prefix: "/maps",
  decorateReply: false,
});

const engine = new Liquid({
  root: path.join(process.cwd(), "src", "views"),
  extname: ".liquid",
});

app.register(pointOfView, {
  engine: {
    liquid: engine,
  },
  root: path.join(process.cwd(), "src", "views"),
  viewExt: "liquid",
  defaultContext: {},
});

app.get("/", async (request, reply) => {
  return reply.view("index.liquid", {
    url: `${config.baseUrl}/${request.url}`,
    categories: config.categories.map((cat) => ({
      name: cat.name,
      // logo name must end in the right extension
      logo: `/img/logos/${cat.logo}`,
      maps: cat.maps.map((map) => ({
        name: map.name,
        url: `/maps/${cat.name}/${map.name}`,
      })),
    })),
  });
});

// app get regex that matches /maps/:category/:map but not /maps/:category/:map.png
app.get('/maps/:category/:map(^[^.]+$)', async (request, reply) => {
// app.get("/maps/:category/:map", async (request, reply) => {
  const { category: rCategory, map: rMap } = request.params as { category: string; map: string };

  const categoryConfig = config.categories.find((cat) => cat.name === rCategory);

  if (!categoryConfig) {
    return reply.status(404).view("pages/error.liquid", {
      error: `Category ${rCategory} not found`,
    });
  }

  const mapConfig = categoryConfig.maps.find((map) => map.friendlyName === rMap || map.name === rMap);
  if (!mapConfig) {
    return reply.status(404).view("pages/error.liquid", {
      error: `Map ${rMap} not found in category ${rCategory}`,
    });
  }

  let zLevels = 1;

  const zLevelRegex = new RegExp(`${mapConfig.name}-(\\d+)`, "i");
  const mapFiles = await fs.readdir(path.join(MAPS_PATH, categoryConfig.name));
  const mapFilesWithZLevels = mapFiles.filter((file) => zLevelRegex.test(file));
  zLevels = mapFilesWithZLevels.length;

  return reply.view("pages/map.liquid", {
    url: `${config.baseUrl}/${request.url}`,
    category: rCategory,
    map: {
      name: mapConfig.name,
      friendlyName: mapConfig.friendlyName,
      zLevels,
      supportsPipes: mapConfig.supportsPipes,
    },
  });
});

app.listen({ port: 3000 }, (err, address) => {
  if (err) throw err;
});

// watch the config file for changes
const configFile = path.join(process.cwd(), "config.json");
fswatch(configFile, async (eventType, filename) => {
  if (eventType === "change") {
    logger.info("Config file changed, reloading...");
    const newConfig = await fs.readFile(configFile, "utf-8");
    const parsedConfig = JSON.parse(newConfig) as MapConfig;
    config = parsedConfig;
    logger.info("New config loaded", parsedConfig);
  }
});
