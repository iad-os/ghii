# GHII

## WHAT'S GHII?
When an application has multiple configurations it has to check them but the risk is to lose something. <br />
Ghii is a library to validate and manage app configurations (environmental variables, json package, http, yaml) in a single object ensuring simplicity and security.
Ghii gives you permission to access the object for application information obtained by asynchronous methods.

## HOW IS IT WORK?
First you must create a ghii object and define all app configurations you want validate (like the example: env, name, config):
```TypeScript
import ghii from '@ghii/ghii';
import envsLoader from '@ghii/envs-loader';

const options = ghii<{
  env: 'development' | 'production';
  name: {
    appVersion: string;
  };
  configs: {
    url: { local: string; path: string }[];
  };
}>()
...
```
Then you can create sections.
In every **section** you can indicate a default value and define a **validator** (for validation Joi is used).

```TypeScript
const options = ghii<{
  env: 'development' | 'production';
  name: {
    appVersion: string;
  };
  configs: {
    url: { local: string; path: string }[];
  };
}>()
  .section('env', {
    validator: joi => joi.string().allow('development', 'production'),
    defaults: 'production',
  })
  .section('name', {
    defaults: {
      appVersion: '0.0.1',
    },
    validator: joi =>
      joi.object({
        appVersion: joi.string(),
      }),
  })
  ...
```

Finally you can define a **loader**, an asynchronous function withouth arguments, that return a generic object.
In this object you can define some or all part of your app configurations (in the example load configurations via environment variables with MYAPP prefix):
```TypeScript
.loader(envsLoader({ envs: process.env, prefix: 'MYAPP' }));
```
In the index page you must define the entry point for ghii (options is the import for ghii configuration) and at this point you can access on all ghii informations sistematically (in the example you obtain informations about the last app snapshot):
```TypeScript
import './util/configs';
import options from './config/options';
import log from './config/log';

(async () => {
  const logger = log({
    xRequest: 'ghii',
    tags: ['ghii-snapshot'],
  });

  try {
    await options.waitForFirstSnapshot({ timeout: 10000 }, __dirname, './main');
    logger.debug({ options: options.snapshot() }, 'CONFIG-SNAPSHOT - OK');
  } catch (err) {
    logger.error(err, 'CONFIG-SNAPSHOT - KO');
  }
})();
```
When starting the app, ghii start, called all validators and then invokes all loaders, create an unique object to validate configurations. If all is ok the app starts up, otherwise it stops.
### Ghii Loader Repository
Here there are some loader you can install into your application:
* YAML LOADER: https://github.com/iad-os/ghii-yaml-loader
* HTTP LOADER: https://github.com/iad-os/ghii-http-loader
* PACKAGE-JSON LOADER: https://github.com/iad-os/ghii-package-json-loader
* ENVS LOADER: https://github.com/iad-os/ghii-envs-loader
### USE AND SETUP

```sh
npm install @ghii/ghii
npm install @ghii/yaml-loader
npm install @ghii/http-loader
npm install @ghii/package-json-loader
npm install @ghii/envs-loader
```
### STARTER
* https://gitlab.iad2.it/cloud-coach/starters/ts-mongo-express-starter
### EXAMPLES
* https://github.com/iad-os/ghii-nodejs-typescrypt-express-example

