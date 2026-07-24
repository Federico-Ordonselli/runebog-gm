import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.env.RUNEB0G_ROOT
  ? pathToFileURL(path.resolve(process.env.RUNEB0G_ROOT) + path.sep)
  : new URL("../../", import.meta.url);

export const repoUrl = relative => new URL(relative, root).href;
