// npm run release:zip -> release/dao-den-long-web-v1.0.0.zip : the built static web game (dist/web) plus a short how-to.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const web = "dist/web";
if (!existsSync(join(web, "index.html"))) {
  console.error("dist/web is missing: run `npm run build` first");
  process.exit(1);
}
const out = "release/dao-den-long-web-v1.0.0.zip";
mkdirSync("release", { recursive: true });
rmSync(out, { force: true });
writeFileSync(
  join(web, "HOW-TO-RUN.txt"),
  [
    "Đảo Đèn Lồng v1.0.0 (static web build)",
    "",
    "Serve this folder with any static web server and open it in a modern browser (Chrome, Edge, Firefox, Safari), for example:",
    "  npx serve .            or            python3 -m http.server 8080",
    "then open http://localhost:8080/ . Opening index.html straight from disk may be blocked by the browser.",
    "",
    "Controls: WASD move, Space jump, Shift dash, E put fireflies into a lantern, F light pulse, Esc/P pause, arrows or mouse drag turn the camera.",
    "Keys can be changed in Settings. The leaderboard and settings are kept in the browser (localStorage).",
    "Full project, tests and the desktop (Electron) build: see the repository README.",
    "",
  ].join("\n"),
);
copyFileSync("LICENSE", join(web, "LICENSE"));
execFileSync("zip", ["-r", "-q", join("..", "..", out), "."], { cwd: web, stdio: "inherit" });
rmSync(join(web, "HOW-TO-RUN.txt"));
rmSync(join(web, "LICENSE"));
console.log(`wrote ${out}`);
