import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const targetFile = path.resolve(__dirname, "../components/home/HomeClient.tsx");

const mode = process.argv[2];

if (mode !== "drawer" && mode !== "sidebar") {
  console.error("Uso inválido. Use: node scripts/toggle-catalog-layout.mjs [drawer|sidebar]");
  process.exit(1);
}

if (!fs.existsSync(targetFile)) {
  console.error(`Arquivo não encontrado: ${targetFile}`);
  process.exit(1);
}

let content = fs.readFileSync(targetFile, "utf8");

if (mode === "sidebar") {
  content = content.replace(
    /CATALOG_LAYOUT_MODE:\s*"drawer"\s*\|\s*"sidebar"\s*=\s*"drawer"/,
    'CATALOG_LAYOUT_MODE: "drawer" | "sidebar" = "sidebar"'
  );
  fs.writeFileSync(targetFile, content, "utf8");
  console.log("\n[SUCESSO] Modo 'sidebar' (design anterior com lateral fixa) ATIVADO com sucesso!");
} else {
  content = content.replace(
    /CATALOG_LAYOUT_MODE:\s*"drawer"\s*\|\s*"sidebar"\s*=\s*"sidebar"/,
    'CATALOG_LAYOUT_MODE: "drawer" | "sidebar" = "drawer"'
  );
  fs.writeFileSync(targetFile, content, "utf8");
  console.log("\n[SUCESSO] Modo 'drawer' (novo design centralizado com gaveta) ATIVADO com sucesso!");
}
