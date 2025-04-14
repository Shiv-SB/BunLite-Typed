# BunLite-Typed 🚀
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/sqlite-%2307405e.svg?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![npm version](https://img.shields.io/npm/v/bunlite-typed.svg?style=for-the-badge)](https://www.npmjs.com/package/bunlite-typed)

## Overview [![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](https://github.com/Shiv-SB/BunLite-Typed) [![Package Size](https://img.shields.io/badge/size-33%20KB-blue.svg)](https://www.npmjs.com/package/bunlite-typed)

A lightweight, type-safe ORM for Bun's SQLite, designed to provide additional type safety when working with Bun's built-in SQLite library.
This is a simple and light wrapper that focuses on core functionality. While some features from popular ORMs (like migrations and runtime response validation) are not included, contributions are welcome via fork or PR if you need these features.

**[View on NPM](https://www.npmjs.com/package/bunlite-typed)** | **[GitHub Repository](https://github.com/Shiv-SB/BunLite-Typed)**

## Features
- 🔒 Full TypeScript support with type inference
- 🎯 Type-safe table operations
- 🚦 Foreign key constraint management
- 📝 Schema validation
- 🔄 CRUD operations with type checking
- ⚡ Runtime table and column checking
- 📦 Zero dependencies! - uses only Bun's built-in SQLite library
- 🧪 Comprehensive test suite with 100% coverage

## Installation

```bash
bun add bunlite-typed
```

## Usage

### Basic Example

```typescript
import BunLiteDB, { type DefineSchema } from 'bunlite-typed';

// Define your schema types
type UserSchema = {
  id: number;
  name: string;
  email: string;
};

type PostSchema = {
  id: number;
  userId: number;
  title: string;
  content: string;
};

// Use DefineSchema helper to create the database schema
type MyDatabase = DefineSchema<{
  users: UserSchema;
  posts: PostSchema;
}>;

// Create schema configuration
const schemaConfig = {
  users: {
    id: { type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
    name: { type: "TEXT NOT NULL" },
    email: { type: "TEXT UNIQUE NOT NULL" }
  },
  posts: {
    id: { type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
    userId: { type: "INTEGER", foreignKey: "REFERENCES users(id)" },
    title: { type: "TEXT NOT NULL" },
    content: { type: "TEXT NOT NULL" }
  }
};

// Initialize database with schema configuration
const db = new BunLiteDB<MyDatabase>("mydb.sqlite", schemaConfig);

// Create all tables from schema
db.createTablesFromSchema();

// Type-safe insertions
db.insertRecord("users", {
  name: "John Doe",
  email: "john@example.com"
  // id is auto-generated
});

// Query with full type inference
const users = db.fetchAllRecords("users");
// users is typed as UserSchema[]
```

### Advanced Usage

```typescript
// Upsert with type checking
db.upsertRecord(
  "users",
  { name: "John Updated", email: "john@example.com" },
  "email"  // Conflict column is type-checked
);

// Typed query results
const user = db.fetchRecordsWithCondition(
  "users",
  "email = ?",
  ["john@example.com"]
);

// Get schema information
const schema = db.getSchema("users");
```

#### Using Pagination

```typescript
// Fetch page 1 with 10 records per page
const page1 = db.fetchRecordsWithPagination("users", 1, 10);

// Fetch page 2
const page2 = db.fetchRecordsWithPagination("users", 2, 10);
```

#### Using Iterator

```typescript
// Iterate through all records efficiently
async function processUsers() {
  for await (const user of db.recordsIterator("users")) {
    console.log(user.name);
  }
}

// Or with a custom batch size
async function processUsersWithBatch() {
  for await (const user of db.recordsIterator("users", 500)) {
    console.log(user.name);
  }
}
```

## API Reference

### Constructor
```typescript
new BunLiteDB<Schema>(
  dbName: ":memory:" | string,
  schemaConfig?: SchemaConfig<Schema>,
  opts?: DbOptions
)
```

### Methods
- `createTablesFromSchema()`: Create tables from schema configuration
- `createTable(tableName, columns)`: Create a new table
- `insertRecord(tableName, values)`: Insert a new record
- `upsertRecord(tableName, values, conflictColumn)`: Insert or update a record
- `fetchAllRecords(tableName, limit?)`: Retrieve all records
- `fetchRecordsWithCondition(tableName, condition, values)`: Query with conditions
- `fetchRecordsWithPagination(tableName, page, pageSize)`: Get records with pagination
- `recordsIterator(tableName, batchSize?)`: Async iterator for efficient record processing
- `getSchema(tableName)`: Get table schema information
- `deleteTable(tableName)`: Delete a table
- `closeConnection()`: Close database connection
- `setForeignKeyMode(mode)`: Set foreign key constraints mode
- `database`: Get the underlying Bun SQLite Database instance

## Requirements
- Bun >= 1.2.0
- TypeScript >= 5.0

## Development

### Building
To build the project:
```bash
bun run build
```

### Testing
To run the test suite:
```bash
bun test
```

### Publishing
To publish to NPM
```bash
bun publish.ts
```

## License
MIT License - feel free to use this in your projects!

## Contributing
Contributions are welcome! Feel free to submit PRs or open issues.
