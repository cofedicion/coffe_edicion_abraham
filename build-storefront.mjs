import { copyFile, cp, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import "./check-preview.mjs";

await mkdir(new URL("./public/admin/", import.meta.url), { recursive: true });
for (const file of [
  "index.html", "site.html", "privacidad.html", "terminos.html", "404.html", "robots.txt", "sitemap.xml",
  "shop.js", "stock.js", "stock.css", "form-fields.js", "preferences.js", "legal.css", "admin/panel.css",
]) {
  await copyFile(new URL(file, import.meta.url), new URL(`./public/${file}`, import.meta.url));
}
await cp(new URL("./assets/", import.meta.url), new URL("./public/assets/", import.meta.url), { recursive: true });

for (const font of ["playfair-display", "plus-jakarta-sans"]) {
  const base = `./node_modules/@fontsource-variable/${font}`;
  await copyFile(new URL(`${base}/files/${font}-latin-wght-normal.woff2`, import.meta.url), new URL(`./public/assets/${font}.woff2`, import.meta.url));
  await copyFile(new URL(`${base}/LICENSE`, import.meta.url), new URL(`./public/assets/${font}-LICENSE.txt`, import.meta.url));
}
execFileSync(process.execPath, ["node_modules/tailwindcss/lib/cli.js", "-c", "tailwind.config.cjs", "-i", "storefront.css", "-o", "public/storefront.css", "--minify"], {
  cwd: fileURLToPath(new URL("./", import.meta.url)), stdio: "inherit",
});
