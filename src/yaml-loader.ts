import { Loader } from './ghii';
import yaml from 'js-yaml';
import * as fs from 'fs';
import { promisify } from 'util';
import path from 'path';
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);

export default function yamlLoader(file: string): Loader {
  if (fs.existsSync(path.join(__dirname, file))) throw new Error(`${file} 404`);
  return async function yamlFileLoader() {
    const fstat = await stat(file);
    if (fstat.isFile()) {
      const yamlContent = await readFile(file, { encoding: 'utf8' });
      return yaml.safeLoad(yamlContent) as { [key: string]: unknown };
    }
    throw new Error(`FILE DELETED -> ${file} 404`);
  };
}
