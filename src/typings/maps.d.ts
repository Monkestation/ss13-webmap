export interface MapInfo {
  name: string;
  friendlyName: string;
  /** @description the path to the map, relative to the basePath of the category. Path can be absolute if it differs from the categorys basePath */
  dmmPath: string;
  supportsPipes?: boolean;
  renderOnce?: boolean;
  doFTL?: boolean;
}

export interface MapSubCategory {
  name: string;
  friendlyName: string;
  renderOnce?: boolean;
  supportsPipes?: boolean;
  doFTL?: boolean;
  maps: MapInfo[];
}

export interface MapCategory {
  name: string;
  friendlyName: string;
  /** @description icon file name in the src/public/img/logos folder */
  logo: string;
  /** @description the path to the game/codebase */
  gamePath: string;
  /** @description By default this is tgstation.dme, but you can specify others like vanderlin.dme */
  envFile: string;
  /** @description basePath for maps in this category, relative to the gamePath, for ease of use */
  mapFilesPath: string;
  supportsPipes?: boolean;
  renderOnce?: boolean;
  doFTL?: boolean;
  maps?: MapInfo[];
  subcategories?: MapSubCategory[];
}

export interface MapConfig {
  $schema: string;
  /** @description the domain name that this will be hosted on, do not include trailing slash */
  baseUrl: string;
  categories: MapCategory[];
}
