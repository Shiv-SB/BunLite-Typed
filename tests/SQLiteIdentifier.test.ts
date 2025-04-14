import { describe, expect, it } from "bun:test";
import BunLiteDB, { DataTypes } from "../src/index";

type TestSchema = {
    test: {
        id: number;
        value: string;
    }
};

describe("SQLite Identifier Validation", () => {
    const schemaConfig = {
        test: {
            id: { type: "INTEGER PRIMARY KEY AUTOINCREMENT" as DataTypes },
            value: { type: "TEXT NOT NULL" as DataTypes }
        }
    };
    const db = new BunLiteDB<TestSchema>(":memory:", schemaConfig);

    const validNames: string[] = [
        "table1",
        "my_table",
        "Table_123",
        "_hidden",
        "table$special",
        "a".repeat(128)  // Maximum identifier length
    ];

    const invalidNames: string[] = [
        "",                     
        "1table",              
        "my table",            
        "drop-table",          
        "table;",              
        "table@",              
        "table.name",          
        "table--",             
        "table' OR '1'='1",    
        "CREATE",                       // Reserved keyword
        "SELECT",                       // Reserved keyword
        "\u0000table",                  // Null byte
        "table\u0000",                  // Null byte
        "😀table",                      // Emoji
        "table😀"                       // Emoji
    ];

    validNames.forEach(name => {
        it(`accepts valid identifier: ${name}`, () => {
            expect(() => {
                // @ts-expect-error - Testing private method
                db.validateSQLiteIdentifier(name, 'table')
            }).not.toThrow();
        });
    });

    invalidNames.forEach(name => {
        it(`rejects invalid identifier: ${name}`, () => {
            expect(() => {
                // @ts-expect-error - Testing private method
                db.validateSQLiteIdentifier(name, 'table')
            }).toThrow();
        });
    });

    it("rejects undefined identifier", () => {
        expect(() => {
            // @ts-expect-error - Testing invalid input
            db.validateSQLiteIdentifier(undefined, 'table')
        }).toThrow();
    });

    it("rejects null identifier", () => {
        expect(() => {
            // @ts-expect-error - Testing invalid input
            db.validateSQLiteIdentifier(null, 'table')
        }).toThrow();
    });
});
