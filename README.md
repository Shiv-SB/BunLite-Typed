# BunLite-Typed 🚀
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/sqlite-%2307405e.svg?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)

A lightweight, type-safe ORM for Bun's SQLite. Designed to provide additional type safety when working with Bun's built-in SQLite library.

## Features
- 🔒 Full TypeScript support with type inference
- 🎯 Type-safe table operations
- 🚦 Foreign key constraint management
- 📝 Schema validation
- 🔄 CRUD operations with type checking

## Installation

```bash
bun add bunlite-typed
```

## Usage

### Basic Example

```typescript
import BunLiteDB from 'bunlite-typed';

// Define your database schema
type DatabaseSchema = {
  Users: {
    id?: number;  // Optional because we'll let SQLite auto-generate it
    name: string;
    email: string;
  };
  Posts: {
    id?: number;  // Optional because we'll let SQLite auto-generate it
    userId: number;
    title: string;
    content: string;
  };
};

// Initialize database with type-safe table names
const db = new BunLiteDB<keyof DatabaseSchema, DatabaseSchema>(
  "mydb.SQLite",
  ["Users", "Posts"]
);

// Create tables with type checking on column names and types
db.createTable("Users", [
  { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
  { name: "name", type: "TEXT NOT NULL" },
  { name: "email", type: "TEXT UNIQUE NOT NULL" }
]);

// Type-safe insertions
db.insertRecord("Users", {
  name: "John Doe",
  email: "john@example.com"
  // id can be omitted since we marked it as optional in the type
  // and configured it with AUTOINCREMENT in the schema
});

// Query with full type inference
const users: DatabaseSchema["Users"][] = db.fetchAllRecords("Users");
// users is now fully typed with { id: number, name: string, email: string }[]
```

### Advanced Usage

```typescript
// Upsert with type checking on values and conflict column
db.upsertRecord(
  "Users",
  { id: 1, name: "John Updated", email: "john@example.com" },
  "email" // Type safe conflic column
);

// Typed query results
const user: DatabaseSchema["Users"][] = db.fetchRecordsWithCondition(
  "Users",
  "email = ?",
  ["john@example.com"]
);

// Schema information with typed column names
const schema = db.getSchema("Users");
// Returns typed information about columns including names and types
```

## API Reference

### Constructor
```typescript
new BunLiteDB(dbName: string, tableNames: string[], opts?: DatabaseOptions)
```

### Methods
- `createTable(tableName, columns)`: Create a new table
- `insertRecord(tableName, values)`: Insert a new record
- `upsertRecord(tableName, values, conflictColumn)`: Insert or update a record
- `fetchAllRecords(tableName, limit?)`: Retrieve all records
- `fetchRecordsWithCondition(tableName, condition, values)`: Query with conditions
- `getSchema(tableName)`: Get table schema
- `deleteTable(tableName)`: Delete a table
- `closeConnection()`: Close database connection
- `setForeignKeyMode(mode)`: Set foreign key constraints

## Requirements
- Bun >= 1.2.0
- TypeScript >= 5.0

## License
MIT License - feel free to use this in your projects!

## Contributing
Contributions are welcome! Feel free to submit PRs or open issues.
