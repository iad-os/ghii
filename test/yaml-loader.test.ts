import Ghii, { ghii } from '../src/ghii';
import yamlLoader from '../src/yaml-loader';
describe('Ghii Yaml Loader', () => {
  it('export a function', () => {
    expect(typeof yamlLoader).toBe('function');
  });

  describe('to create a loader', () => {
    it('load default (valid) options', async () => {
      const yamlFileLoader = yamlLoader('./test/test.yaml');
      expect(typeof yamlFileLoader).toBe('function');
    });
  });
});
