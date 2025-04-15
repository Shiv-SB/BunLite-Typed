# Changelog

All notable changes to this project will be documented in this file.

## [3.0.0] - 2024

### Breaking Changes
- Changed database initialization to use a schema object
- Removed direct table names array constructor parameter
- Changed table creation to use schema-first approach

### Added
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
// No type arguments needed in constructor

// Example 1:
const schemaConfig = {
  users: {
    id: { type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
    name: { type: "TEXT NOT NULL" }
  },
  posts: {
    id: { type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
    userId: { type: "INTEGER", foreignKey: "REFERENCES users(id)" }
  }
} as const;

const db = new BunLiteDB("mydb.db", schemaConfig);

// Auto create tables:
db.createTablesFromSchema();

// Example 2:

// schemas provided directly in the constructor do not need type assertions
const db = new BunLiteDB("mydb.db", {
    users: {
    id: { type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
    name: { type: "TEXT NOT NULL" }
  },
});

```
