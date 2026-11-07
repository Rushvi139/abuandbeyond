export type Cuisine = "abu" | "italy" | "mexico" | "china" | "lebanon";

export type OptionChoice = { id: string; name: string; priceDeltaPaise: number };
export type OptionGroup = { id: string; name: string; required: boolean; choices: OptionChoice[] };
export type Addon = { id: string; name: string; pricePaise: number; isVeg: boolean };

export type MenuItem = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string | null;
  isVeg: boolean;
  pricePaise: number;
  cuisine: Cuisine;
  available: boolean;
  imagePath: string | null;
  optionGroups: OptionGroup[];
  addons: Addon[];
};

export type Category = { id: string; name: string; slug: string; items: MenuItem[] };

export const CUISINE_LABEL: Record<Cuisine, string> = {
  abu: "ABU",
  italy: "ABU & ITALY",
  mexico: "ABU & MEXICO",
  china: "ABU & CHINA",
  lebanon: "ABU & LEBANON",
};
