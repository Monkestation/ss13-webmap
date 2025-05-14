import * as esbuild from 'esbuild';
import { sassPlugin } from 'esbuild-sass-plugin';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import fs from 'node:fs/promises';
import path from 'node:path';

const cssDir = 'src/public/css';
const jsDir = 'src/public/js';

async function buildCSS() {
  try {
    await fs.mkdir(cssDir, { recursive: true });
    const cssFiles = await fs.readdir(cssDir);

    await Promise.all(
      cssFiles
        .filter(file => file.endsWith('.scss') || (file.endsWith('.css') && !file.endsWith('.min.css')))
        .map(async file => {
          const inputFile = path.join(cssDir, file);
          const outputFile = path.join(cssDir, file.replace(/\.(scss|css)$/, '.min.css'));
          try {
            await esbuild.build({
              entryPoints: [inputFile],
              outfile: outputFile,
              minify: true,
              bundle: false,
              plugins: [
                sassPlugin({
                  async transform(css) {
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
        })
    );
    console.log('CSS processing complete.');
  } catch (error) {
    console.error('Error during CSS build:', error);
  }
}

async function buildJS() {
  try {
    await fs.mkdir(jsDir, { recursive: true });
    const jsFiles = await fs.readdir(jsDir);

    await Promise.all(
      jsFiles
        .filter(file => file.endsWith('.js') && !file.endsWith('.min.js'))
        .map(async file => {
          const inputFile = path.join(jsDir, file);
          const outputFile = path.join(jsDir, file.replace(/\.js$/, '.min.js'));
          await esbuild.build({
            entryPoints: [inputFile],
            outfile: outputFile,
            minify: true,
            bundle: false,
          });
          console.log(`Processed JS: ${inputFile} -> ${outputFile}`);
        })
    );
    console.log('JavaScript processing complete.');
  } catch (error) {
    console.error('Error during JS build:', error);
  }
}

async function main() {
  await Promise.all([buildCSS(), buildJS()]);
  console.log('All builds completed.');
}

main();
