# GHII - A Funny Configuration Manager

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue.svg)](https://www.typescriptlang.org/)

GHII is a powerful, type-safe configuration management library for Node.js applications. It provides a flexible and extensible way to load, validate, and manage configuration data from multiple sources with full TypeScript support.

## Table of Contents

- [Introduction](#introduction)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
- [Usage Examples](#usage-examples)
- [Advanced Features](#advanced-features)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Introduction

### What is GHII?

GHII is a configuration management library that combines the power of validation engines (like Zod) with flexible loading mechanisms. It allows you to:

- Load configuration from multiple sources (files, environment variables, APIs, etc.)
- Validate configuration data with full type safety
- Handle configuration changes with event-driven architecture
- Generate JSON schemas from your configuration definitions
- Maintain configuration snapshots with versioning

### Key Features

- 🔒 **Type Safety**: Full TypeScript support with compile-time type checking
- 🔧 **Flexible Loading**: Support for multiple configuration sources
- ✅ **Validation**: Built-in validation with customizable engines
- 📡 **Event-Driven**: React to configuration changes with events
- 🔄 **Snapshot Management**: Versioned configuration snapshots
- 📋 **Schema Generation**: Automatic JSON schema generation
- ⚡ **Performance**: Efficient deep comparison and caching

### Why GHII?

GHII stands out from other configuration managers by providing:

- **Type Safety**: Unlike many configuration libraries, GHII ensures your configuration is fully typed
- **Validation First**: Configuration is validated before being used, preventing runtime errors
- **Event System**: Built-in support for reacting to configuration changes
- **Extensible**: Easy to add custom validation engines and loaders
- **Modern**: Built for Node.js 22+ with modern JavaScript features

## Installation

### Prerequisites

- Node.js 22 or higher
- TypeScript 5.8+ (recommended)

### Installation Commands

```bash
npm install @ghii/ghii-v2
```

### TypeScript Support

GHII is written in TypeScript and provides full type definitions out of the box. No additional `@types` package is required.

## Quick Start

### Basic Setup

```typescript
import { ghii } from '@ghii/ghii-v2';
import { z } from 'zod/v4';

// Define your configuration schema
const configSchema = z.object({
  server: z.object({
    port: z.number().default(3000),
    host: z.string().default('localhost'),
  }),
  database: z.object({
    url: z.string().url(),
    poolSize: z.number().min(1).max(20).default(10),
  }),
});

// Create a Zod engine
const engine = {
  validate: (config: unknown) => {
    const result = configSchema.safeParse(config);
    if (result.success) {
      return { success: true, value: result.data };
    } else {
      return {
        success: false,
        errors: result.error.issues.map(issue => ({
          path: issue.path.join('.'),
          input: issue.input,
          details: issue.code,
          message: issue.message,
          _raw: issue,
        })),
      };
    }
  },
  toSchema: () => z.toJSONSchema(configSchema),
};

// Initialize GHII
const config = ghii(engine)
  .loader(async () => ({
    database: {
      url: process.env.DATABASE_URL || 'postgresql://localhost:5432/myapp',
    },
  }))
  .loader(async () => ({
    server: {
      port: parseInt(process.env.PORT || '3000'),
    },
  }));

// Take a snapshot
const snapshot = await config.takeSnapshot();
console.log(snapshot);
```

### Simple Configuration Example

```typescript
import { ghii } from '@ghii/ghii-v2';
import { z } from 'zod/v4';

// Simple configuration with defaults
const appConfig = ghii({
  validate: (config: unknown) => {
    const schema = z.object({
      name: z.string().default('my-app'),
      version: z.string().default('1.0.0'),
      debug: z.boolean().default(false),
    });
    
    const result = schema.safeParse(config);
    return result.success 
      ? { success: true, value: result.data }
      : { success: false, errors: result.error.issues.map(/* ... */) };
  },
  toSchema: () => ({ /* schema */ }),
});

// Load configuration
const config = await appConfig.takeSnapshot();
console.log(config); // { name: 'my-app', version: '1.0.0', debug: false }
```

## Core Concepts

### Configuration Engine

The configuration engine is responsible for validating configuration data. It must implement two methods:

- `validate(toValidate)`: Validates configuration and returns success/error result
- `toSchema()`: Returns a JSON schema representation of the configuration

### Loaders

Loaders are functions that return configuration data. They can be:
- Synchronous or asynchronous
- Load from files, environment variables, APIs, etc.
- Combined to merge multiple configuration sources

### Snapshots

A snapshot is a validated, immutable copy of your configuration at a specific point in time. Snapshots are versioned and can be compared for changes.

### Validation

All configuration data is validated before being used. Invalid configuration throws detailed error messages with paths to problematic values.

### Events

GHII emits events when configuration changes:
- `ghii:first`: Emitted when the first valid configuration is loaded
- `ghii:refresh`: Emitted when configuration is updated

## API Reference

### `ghii(engine)`

Creates a new GHII instance with the specified validation engine.

**Parameters:**
- `engine`: A validation engine object with `validate` and `toSchema` methods

**Returns:** A GHII instance with the following methods:

#### `.loader(loaderFunction)`

Adds a configuration loader.

**Parameters:**
- `loaderFunction`: A function that returns configuration data (sync or async)

**Returns:** The GHII instance for chaining

#### `.takeSnapshot()`

Loads and validates configuration from all loaders.

**Returns:** Promise<Config> - The validated configuration

#### `.snapshot()`

Returns the current configuration snapshot without reloading.

**Throws:** Error if no snapshot exists

#### `.waitForSnapshot(options?)`

Waits for a valid configuration snapshot.

**Parameters:**
- `options.timeout`: Timeout in milliseconds (default: 30000)
- `options.onTimeout`: Callback when timeout occurs
- `options.onValidSnapshot`: Callback when valid snapshot is available

**Returns:** Promise<Config>

#### `.on(event, listener)`

Registers an event listener.

**Events:**
- `'ghii:first'`: Emitted on first valid configuration
- `'ghii:refresh'`: Emitted when configuration changes

#### `.once(event, listener)`

Registers a one-time event listener.

#### `.jsonSchema()`

Returns the JSON schema as a string.

## Usage Examples

### Basic Configuration

```typescript
import { ghii } from '@ghii/ghii-v2';
import { z } from 'zod';

const config = ghii({
  validate: (data) => {
    const schema = z.object({
      app: z.object({
        name: z.string(),
        version: z.string(),
      }),
    });
    const result = schema.safeParse(data);
    return result.success 
      ? { success: true, value: result.data }
      : { success: false, errors: result.error.issues.map(/* ... */) };
  },
  toSchema: () => ({ /* schema */ }),
})
.loader(() => ({
  app: {
    name: 'my-app',
    version: '1.0.0',
  },
}));

const snapshot = await config.takeSnapshot();
```

### Environment-based Configuration

```typescript
const config = ghii(engine)
  .loader(() => ({
    database: {
      url: process.env.DATABASE_URL,
      poolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
    },
    server: {
      port: parseInt(process.env.PORT || '3000'),
      host: process.env.HOST || 'localhost',
    },
  }));
```

### File-based Configuration

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

const config = ghii(engine)
  .loader(() => {
    const configPath = join(process.cwd(), 'config.json');
    const configData = JSON.parse(readFileSync(configPath, 'utf8'));
    return configData;
  });
```

### Multiple Loaders

```typescript
const config = ghii(engine)
  // Default configuration
  .loader(() => ({
    server: { port: 3000, host: 'localhost' },
    database: { poolSize: 10 },
  }))
  // Environment overrides
  .loader(() => ({
    server: { port: parseInt(process.env.PORT || '3000') },
  }))
  // File overrides
  .loader(async () => {
    const fileConfig = await loadConfigFile();
    return fileConfig;
  });
```

### Custom Validation

```typescript
const config = ghii({
  validate: (data) => {
    // Custom validation logic
    if (!data.apiKey || data.apiKey.length < 10) {
      return {
        success: false,
        errors: [{
          path: 'apiKey',
          input: data.apiKey,
          details: 'invalid_length',
          message: 'API key must be at least 10 characters',
          _raw: null,
        }],
      };
    }
    
    return { success: true, value: data };
  },
  toSchema: () => ({ type: 'object', properties: { /* ... */ } }),
});
```

### Event Handling

```typescript
const config = ghii(engine)
  .loader(/* ... */);

// Listen for first configuration
config.once('ghii:first', () => {
  console.log('Configuration loaded for the first time');
});

// Listen for configuration changes
config.on('ghii:refresh', (activeConfig) => {
  console.log('Configuration updated:', {
    version: activeConfig.version,
    config: activeConfig.config,
    previousConfig: activeConfig.previousConfig,
  });
});

await config.takeSnapshot();
```

## Advanced Features

### Custom Engines

You can create custom validation engines for different validation libraries:

```typescript
// Joi engine example
import Joi from 'joi';

function joiEngine(schema: Joi.Schema) {
  return {
    validate: (data: unknown) => {
      const result = schema.validate(data);
      if (result.error) {
        return {
          success: false,
          errors: result.error.details.map(detail => ({
            path: detail.path.join('.'),
            input: detail.context?.value,
            details: detail.type,
            message: detail.message,
            _raw: detail,
          })),
        };
      }
      return { success: true, value: result.value };
    },
    toSchema: () => schema.describe(),
  };
}
```

### Schema Generation

Generate JSON schemas for documentation or API specifications:

```typescript
const schema = config.jsonSchema();
console.log(schema);
// Outputs: {"type":"object","properties":{...}}
```

### Error Handling

GHII provides detailed error information:

```typescript
try {
  await config.takeSnapshot();
} catch (errors) {
  errors.forEach(error => {
    console.error(`Error at ${error.path}: ${error.message}`);
    console.error(`Input:`, error.input);
    console.error(`Details:`, error.details);
  });
}
```

### Type Safety

GHII provides full TypeScript support:

```typescript
interface AppConfig {
  server: {
    port: number;
    host: string;
  };
  database: {
    url: string;
    poolSize: number;
  };
}

const config = ghii<AppConfig>(engine);
// config.snapshot() returns AppConfig
// config.takeSnapshot() returns Promise<AppConfig>
```

## Best Practices

### Configuration Structure

- Keep configuration flat when possible
- Use descriptive property names
- Group related settings together
- Provide sensible defaults

### Loader Design

- Make loaders focused and single-purpose
- Handle errors gracefully in loaders
- Use environment-specific loaders
- Cache expensive operations

### Error Handling

- Always validate configuration before use
- Provide meaningful error messages
- Log configuration errors for debugging
- Have fallback configurations

### Performance Considerations

- Use efficient validation engines
- Minimize I/O operations in loaders
- Cache configuration when appropriate
- Use deep comparison sparingly

## Troubleshooting

### Common Issues

**"No snapshot found" Error**
```typescript
// ❌ Wrong
const config = config.snapshot();

// ✅ Correct
const config = await config.takeSnapshot();
// or
const config = config.snapshot(); // after takeSnapshot() has been called
```

**Validation Errors**
```typescript
// Check your schema and input data
try {
  await config.takeSnapshot();
} catch (errors) {
  console.error('Validation errors:', errors);
}
```

**Loader Errors**
```typescript
// Ensure loaders return valid data
.loader(async () => {
  try {
    return await loadConfig();
  } catch (error) {
    console.error('Loader error:', error);
    return {}; // Return empty object as fallback
  }
})
```

### Debugging Tips

1. **Enable logging** in your loaders
2. **Check validation errors** for detailed information
3. **Use TypeScript** for compile-time error detection
4. **Test loaders independently** before combining them

### Error Messages

GHII provides detailed error messages with:
- Path to the problematic value
- Input that caused the error
- Validation details
- Human-readable message

## Contributing

### Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Run tests: `npm test`
4. Run linting: `npm run lint`

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run coverage

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

### Code Style

The project uses:
- **Biome** for linting and formatting
- **TypeScript** for type safety
- **Vitest** for testing

Run formatting: `npm run format`

### Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Maintainers

- **Daniele Fiungo** - [daniele.fiungo@iad2.it](mailto:daniele.fiungo@iad2.it)
- **Nicola Vurchio** - [nicola.vurchio@iad2.it](mailto:nicola.vurchio@iad2.it)
- **Irene La Bollita** - [irene.labollita@iad2.it](mailto:irene.labollita@iad2.it)
