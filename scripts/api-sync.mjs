// Descarga el contrato OpenAPI de la API local (Development) y lo guarda como copia versionada en api/openapi.json.
// Uso: npm run api:sync [-- <url>]   (por defecto http://localhost:5214/openapi/v1.json)
// Después regenera los tipos con `npm run api:types`. La copia es la fuente de verdad del CI: no necesita la API.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_URL = 'http://localhost:5214/openapi/v1.json';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'api', 'openapi.json');
const url = process.argv[2] ?? DEFAULT_URL;

const response = await fetch(url).catch((error) => {
  // La causa más común: la API no está corriendo. Mensaje accionable en lugar de un stack trace.
  throw new Error(
    `Cannot reach ${url} (${error.cause?.code ?? error.message}). Start the API with the "http" profile.`,
  );
});
if (!response.ok) {
  throw new Error(
    `${url} answered ${response.status}. The document is only published in the Development environment.`,
  );
}

const document = await response.json();
if (typeof document.openapi !== 'string' || typeof document.paths !== 'object') {
  throw new Error(`${url} did not return an OpenAPI document.`);
}

// "servers" trae la URL local de quien ejecutó el script: no es parte del contrato y cambiaría en cada máquina.
delete document.servers;

await mkdir(dirname(target), { recursive: true });
// JSON con 2 espacios y salto final: diffs legibles en los PR cuando el contrato cambia.
await writeFile(target, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

const operations = Object.values(document.paths).reduce((count, item) => count + Object.keys(item).length, 0);
process.stdout.write(`Saved api/openapi.json (${document.openapi}, ${operations} operations).\n`);
