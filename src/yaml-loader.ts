import { Loader } from './ghii';
import yaml from 'js-yaml';
import * as fs from 'fs';
import { promisify } from 'util';
import path from 'path';
const stat = promisify(fs.stat);

const readFile = promisify(fs.readFile);

export default function yamlLoader(...filePathToken: string[]): Loader {
  const sourcePath = path.join(...filePathToken);
  if (!fs.existsSync(sourcePath)) throw new Error(`${sourcePath} 404`);
  return async function yamlFileLoader() {
    try {
      const fstat = await stat(sourcePath);
      if (fstat.isFile()) {
        const yamlContent = await readFile(sourcePath, { encoding: 'utf8' });
        return yaml.safeLoad(yamlContent) as { [key: string]: unknown };
      }
      throw new Error(`Source ${sourcePath} is not a file`);
    } catch (err) {
      throw new Error(`FILE DELETED OR A DIRECTORY-> ${sourcePath} 404`);
    }
  };
}
