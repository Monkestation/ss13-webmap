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
        friendlyName: map.friendlyName,
        url: `/maps/${cat.name}/${map.name}`,
      })),
      subcategories: cat.subcategories?.map((subcat) => ({
        name: subcat.name,
        maps: subcat.maps.map((map) => ({
          name: map.name,
          friendlyName: map.friendlyName,
          url: `/maps/${cat.name}/${map.name}`,
        })),
      })),
    })),
  });
});

app.get('/maps/:category/:map(^[^.]+$)', async (request, reply) => {
  const { category: rCategory, map: rMap } = request.params as { category: string; map: string };

  const categoryConfig = config.categories.find((cat) => cat.name === rCategory);

  if (!categoryConfig) {
    return reply.status(404).view("pages/error.liquid", {
      errorCode: 404,
      message: `Category ${rCategory} not found`,
    });
  }

  let mapConfig = categoryConfig.maps.find((map) => map.friendlyName === rMap || map.name === rMap);

  if (!mapConfig) {
    // check subcategories
    if (categoryConfig.subcategories) {
      for (const subcat of categoryConfig.subcategories) {
        mapConfig = subcat.maps.find((map) => map.friendlyName === rMap || map.name === rMap);
        if (mapConfig) {
          break;
        }
      }
    }
  }

  if (!mapConfig) {
    return reply.status(404).view("pages/error.liquid", {
      errorCode: 404,
      message: `Map ${rMap} not found in category ${rCategory}`,
    });
  }

  let zLevels = 1;

  const zLevelRegex = new RegExp(`^${mapConfig.name}-(\\d+)`, "i");
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
      supportsPipes: mapConfig.supportsPipes ?? true,
    },
  });
});

app.setNotFoundHandler((request, reply) => {
  return reply.status(404).view("pages/error.liquid", {
    errorCode: 404,
    message: "Page not found",
  });
});

app.setErrorHandler((error, request, reply) => {
  logger.error(error);
  return reply.status(500).view("pages/error.liquid", {
    errorCode: 500,
    message: "Internal server error",
  });
});
const listenPort = Number.parseInt(process.env.PORT as string) || 3000;

app.listen({ port: listenPort, host: "0.0.0.0" }, (err, address) => {
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
