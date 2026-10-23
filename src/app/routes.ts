// The route tree: the shell's own routes, then each module's, mounted from its folder
// (`routes/public` outside the signed-in shell, `routes/app` inside it). The router generator
// reads this in Node at dev and build time; paths are relative to src/routes.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { layout, physical, rootRoute, route } from "@tanstack/virtual-file-routes";

import { MODULES } from "./modules";

function mounts(area: "app" | "public") {
  return MODULES.filter((id) =>
    existsSync(join(process.cwd(), "src/modules", id, "routes", area)),
  ).map((id) => physical(`../modules/${id}/routes/${area}`));
}

export const routes = rootRoute("__root.tsx", [
  route("/healthz", "healthz.ts"),
  physical("/api", "api"),
  ...mounts("public"),
  layout("_app", "_app.tsx", mounts("app")),
]);
