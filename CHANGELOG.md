# Changelog

All notable changes to this project will be documented in this file.

## [3.0.0] - 2024

### Breaking Changes
- Changed database initialization to use schema configuration instead of table names array
- Removed direct table names array constructor parameter
- Updated type system to use `DefineSchema` helper type
- Changed table creation to use schema-first approach

### Added
- New `SchemaConfig` type for defining table schemas
- Added `DefineSchema` helper type for better type inference
- Added `createTablesFromSchema()` method for initializing all tables at once
- Added runtime checks for reserved SQLite keywords

### Changed
- Improved type safety for table operations
- Updated all examples and tests to use new schema-based approach
- Added more tests to catch edge cases

### Migration Guide
From v2.x to v3.0.0:

```typescript
// Old v2 initialization
const db = new BunLiteDB<Schema>("mydb.sqlite", ["users", "posts"]);

db.createTable("users", [
    { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
    { name: "name", type: "TEXT NOT NULL" },
]);

db.createTable("posts", [
    ...
])

// New v3 initialization
// Use DefineSchema helper to create the database schema
type MyDatabase = DefineSchema<{
  users: {
    id: number;
    name: string;
  },
  posts: {
    id: number;
    userId: number;
  },
}>;

const schemaConfig = {
  users: {
    id: { type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
    name: { type: "TEXT NOT NULL" }
  },
  posts: {
    id: { type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
    userId: { type: "INTEGER", foreignKey: "REFERENCES users(id)" }
  }
};
const db = new BunLiteDB<MyDatabase>("mydb.sqlite", schemaConfig);
db.createTablesFromSchema();
```
