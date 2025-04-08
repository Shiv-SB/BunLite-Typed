import { describe, expect, it } from "bun:test";
import BunLiteDB from "../src/index";

describe("SQLite Identifier Validation", () => {
    const db = new BunLiteDB<"test", { test: {} }>(":memory:", ["test"]);

    // Test valid identifiers
    const validNames = [
        "table1",
        "my_table",
        "Table_123",
        "_hidden",
        "table$special"
    ];

    // Test invalid identifiers
    const invalidNames = [
        "",                     // empty string
        "1table",              // starts with number
        "my table",            // contains space
        "drop-table",          // contains hyphen
        "table;",              // contains semicolon
        "table@",              // contains @
        "table.name",          // contains dot
        "table--",             // SQL injection attempt
        "table' OR '1'='1",    // SQL injection attempt
    ];

    validNames.forEach(name => {
        it(`should accept valid identifier: ${name}`, () => {
            expect(() => {
                // @ts-expect-error - Accessing private method for testing
                db.validateSQLiteIdentifier(name, 'table')
            }).not.toThrow();
        });
    });

    invalidNames.forEach(name => {
        it(`should reject invalid identifier: ${name}`, () => {
            expect(() => {
                // @ts-expect-error - Accessing private method for testing
                db.validateSQLiteIdentifier(name, 'table')
            }).toThrow();
        });
    });
});
