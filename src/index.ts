import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import pointOfView from "@fastify/view";
import fastifyStatic from "@fastify/static";
import { Liquid } from "liquidjs";
import path from "node:path";
import type { MapConfig, MapSubCategory } from "typings/maps";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import { watch as fswatch } from "node:fs";
import { logger } from "./logger";

let config = JSON.parse(fsSync.readFileSync(path.join(process.cwd(), "config.json"), "utf-8")) as MapConfig;

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
      friendlyName: cat.friendlyName,
      // logo name must end in the right extension
      logo: `/img/logos/${cat.logo}`,
      maps: cat.maps?.map((map) => ({
        name: map.name,
        friendlyName: map.friendlyName,
        url: `/maps/${cat.name}/${map.name}`,
      })),
      subcategories: cat.subcategories?.map((subcat) => ({
        name: subcat.name,
        friendlyName: subcat.friendlyName,
        maps: subcat.maps.map((map) => ({
          name: map.name,
          friendlyName: map.friendlyName,
          url: `/maps/${cat.name}/${subcat.name}/${map.name}`,
        })),
      })),
    })),
  });
});

// Route: /maps/:category/:subcategory/:map
app.get('/maps/:category/:subcategory/:map(^[^.]+$)', async (request, reply) => {
  return handleMapRequest(request, reply, true);
});

// Route: /maps/:category/:map
app.get('/maps/:category/:map(^[^.]+$)', async (request, reply) => {
  return handleMapRequest(request, reply, false);
});

// Shared handler
async function handleMapRequest(_request: FastifyRequest, reply: FastifyReply, hasSubcategory: boolean) {
  const request = _request as FastifyRequest<{Params: {
    category: string;
    subcategory?: string;
    map: string;
  }}>;
  const { category: rCategory, map: rMap } = request.params;

  const rSubcategory = hasSubcategory ? request.params.subcategory : undefined;

  const categoryConfig = config.categories.find((cat) => cat.name === rCategory);

  if (!categoryConfig) {
    return reply.status(404).view("pages/error.liquid", {
      errorCode: 404,
      message: `Category ${rCategory} not found`,
    });
  }

  let mapConfig: any = null;
  let subcategoryConfig: MapSubCategory | null | undefined = null;

  if (rSubcategory && categoryConfig.subcategories) {
    subcategoryConfig = categoryConfig.subcategories.find((subcat) => subcat.name === rSubcategory);

    if (!subcategoryConfig) {
      return reply.status(404).view("pages/error.liquid", {
        errorCode: 404,
        message: `Subcategory ${rSubcategory} not found in ${rCategory}`,
      });
    }

    mapConfig = subcategoryConfig.maps.find((map) => map.friendlyName === rMap || map.name === rMap);
  } else {
    mapConfig = categoryConfig.maps?.find((map) => map.friendlyName === rMap || map.name === rMap);

    // fallback: look through subcategories if not found in root
    if (!mapConfig && categoryConfig.subcategories) {
      for (const subcat of categoryConfig.subcategories) {
        const foundMap = subcat.maps.find((map) => map.friendlyName === rMap || map.name === rMap);
        if (foundMap) {
          mapConfig = foundMap;
          subcategoryConfig = subcat;
          break;
        }
      }
    }
  }

  if (!mapConfig) {
    return reply.status(404).view("pages/error.liquid", {
      errorCode: 404,
      message: `Map ${rMap} not found in ${rSubcategory ? `subcategory ${rSubcategory} of ` : ''}category ${rCategory}`,
    });
  }


  return reply.view("pages/map.liquid", {
    url: `${config.baseUrl}/${request.url}`,
    category: rCategory,
    subcategory: subcategoryConfig?.name ?? null,
    map: {
      name: mapConfig.name,
      friendlyName: mapConfig.friendlyName,
      supportsPipes: mapConfig.supportsPipes ?? subcategoryConfig?.supportsPipes ?? categoryConfig.supportsPipes !== false,
      doFTL: mapConfig.doFTL ?? subcategoryConfig?.doFTL ?? categoryConfig.doFTL !== false
    },
  });
}

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

process.on("uncaughtException", (error) => {
  logger.error(error);
});
