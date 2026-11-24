const { copyFile, mkdir, readFile, writeFile } = require("node:fs/promises");
const path = require("node:path");

const ROOT = __dirname;
const OUTPUT = path.join(ROOT, "docs");
const CLIENT_FILES = ["index.html", "styles.css", "app.js", "features.js"];

async function buildPages() {
  await mkdir(OUTPUT, { recursive: true });
  await Promise.all(CLIENT_FILES.map((file) => copyFile(path.join(ROOT, file), path.join(OUTPUT, file))));

  const indexPath = path.join(OUTPUT, "index.html");
  const index = await readFile(indexPath, "utf8");
  if (!index.includes("</head>")) {
    throw new Error("No se encontró el cierre de <head> en index.html.");
  }
  await writeFile(indexPath, index.replace("</head>", "    <script>window.FOCUS_STATIC_HOSTING = true;</script>\n  </head>"));
  await writeFile(path.join(OUTPUT, ".nojekyll"), "");

  console.log("Sitio estático generado en docs/ para GitHub Pages.");
}

buildPages().catch((error) => {
  console.error("No se pudo generar el sitio para GitHub Pages:", error);
  process.exitCode = 1;
});
