import { copyFile, mkdir } from "node:fs/promises";
import "./check-preview.mjs";

await mkdir(new URL("./public/admin/", import.meta.url), { recursive: true });
for (const file of ["index.html", "site.html", "stock.js", "stock.css", "admin/panel.css"]) {
  await copyFile(new URL(file, import.meta.url), new URL(`./public/${file}`, import.meta.url));
}
