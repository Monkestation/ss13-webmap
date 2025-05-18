# Monkestation WebMap

This is the repo of the Monkestation Webmap project, based off of the [static version](https://github.com/AffectedArc07/SS13WebMap/tree/archived) of [AffectArc07's SS13WebMap](https://github.com/AffectedArc07/SS13WebMap), built primarily for Monkestation.

While the page layout remains roughly the same, this version uses Liquid templating and Fastify to serve the map files. It uses a new map generation script, and allows subcategorys in categorys

This project still relys on DMM-Tools from [SpacemanDMM](https://github.com/SpaceManiac/SpacemanDMM/) being present in the root of the project, or in your `PATH`.

[License](LICENSE.md)

TODO:
- [x] better generated map organization (right now it just dumps everything into one folder for each category some filenames could clash...)
- [ ] Work on metadata for map previews on platforms like Discord
