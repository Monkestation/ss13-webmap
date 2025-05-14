export interface MapInfo {
  name: string;
  dmmPath: string;
  zLevels: number;
  supportsPipes: boolean;
}

export interface MapCategory {
  name: string;
  logo: string;
  category: string;
  maps: MapInfo[];
}

export interface MapConfig {
  categories: MapCategory[];
}
