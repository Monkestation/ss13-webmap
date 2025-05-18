// import { sassPlugin } from 'esbuild-sass-plugin';
// import postcss from 'postcss';
// import autoprefixer from 'autoprefixer';
// import fs from 'node:fs/promises';
// import path from 'node:path';

import { mkdir, readdir } from "node:fs/promises";
import fsSync from "node:fs";
import { join } from "node:path";


// const sassNodePath = path.join(__dirname, "..", "node_modules", "sass", "sass.node.js");
// // code to patch line 1 of 'node_modules/sass/sass.node.js' to be require("./sass.dart.js");

// const sassNode = fsSync.readFileSync(sassNodePath, "utf8");
// const patchedSassNode = sassNode.replace(
//   /require\('sass\/sass.dart.js'\);/g,
//   `require("./sass.dart.js");`
// );
// fsSync.writeFileSync(sassNodePath, patchedSassNode, "utf8");


import { build } from "esbuild";
import postcss from "postcss";
// const { default: postcss } = require("postcss");
import { sassPlugin } from "esbuild-sass-plugin";
import autoprefixer from "autoprefixer";

const cssDir = "src/public/css";
const jsDir = "src/public/js";

async function buildCSS() {
  try {
    await mkdir(cssDir, { recursive: true });
    const cssFiles = await readdir(cssDir);

    await Promise.all(
      cssFiles
        .filter((file) => file.endsWith(".scss") || (file.endsWith(".css") && !file.endsWith(".min.css")))
        .map(async (file) => {
          const inputFile = join(cssDir, file);
          const outputFile = join(cssDir, file.replace(/\.(scss|css)$/, ".min.css"));
          try {
            await build({
              entryPoints: [inputFile],
              outfile: outputFile,
              minify: true,
              bundle: false,
              plugins: [
                sassPlugin({
                  transform: async (css) => {
                    const { css: prefixed } = await postcss([autoprefixer]).process(css, { from: undefined });
                    return prefixed;
                  },
                }),
              ],
            });
            console.log(`Processed CSS/SCSS: ${inputFile} -> ${outputFile}`);
          } catch (error) {
            console.error(`Error processing ${inputFile}:`, error);
          }
        }),
    );
    console.log("CSS processing complete.");
  } catch (error) {
    console.error("Error during CSS build:", error);
  }
}

async function buildJS() {
  try {
    await mkdir(jsDir, { recursive: true });
    const jsFiles = await readdir(jsDir);

    await Promise.all(
      jsFiles
        .filter((file) => file.endsWith(".js") && !file.endsWith(".min.js"))
        .map(async (file) => {
          const inputFile = join(jsDir, file);
          const outputFile = join(jsDir, file.replace(/\.js$/, ".min.js"));
          await build({
            entryPoints: [inputFile],
            outfile: outputFile,
            minify: true,
            bundle: false,
          });
          console.log(`Processed JS: ${inputFile} -> ${outputFile}`);
        }),
    );
    console.log("JavaScript processing complete.");
  } catch (error) {
    console.error("Error during JS build:", error);
  }
}

async function main() {
  await Promise.all([buildCSS(), buildJS()]);
  console.log("All builds completed.");
}

main();

if (process.argv.includes("--watch")) {
  console.log("Watching for changes...");
  fsSync.watch(cssDir, { recursive: true }, (eventType, filename) => {
    if (filename.endsWith(".scss") || (filename.endsWith(".css") && !filename.endsWith(".min.css"))) {
      buildCSS();
    }
  });
  fsSync.watch(jsDir, { recursive: true }, (eventType, filename) => {
    if (filename.endsWith(".js") && !filename.endsWith(".min.js")) {
      buildJS();
    }
  });
}
