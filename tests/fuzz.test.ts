import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import BunLiteDB, { DataTypes, SchemaConfig } from '../src/index';

function generateRandomString(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_$';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function generateValidTableName(): string {
    // SQLite identifiers must start with a letter or underscore
    const firstChar = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_';
    return firstChar[Math.floor(Math.random() * firstChar.length)] + generateRandomString(Math.floor(Math.random() * 20) + 1);
}

describe("BunLiteDB Fuzz Tests", () => {
    let db: BunLiteDB<any>;
    let testTableNames: string[];

    beforeEach(() => {
        testTableNames = Array.from({ length: 5 }, generateValidTableName);
        const schemaConfig = Object.fromEntries(
            testTableNames.map(name => [
                name,
                {
                    id: { type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
                    value: { type: "TEXT NOT NULL" }
                }
            ])
        ) as SchemaConfig;
        db = new BunLiteDB(":memory:", schemaConfig);
        db.createTablesFromSchema();
    });

    afterEach(() => {
        db.closeConnection();
    });

    test("fuzz test table creation with random column names", () => {
        const tableName = testTableNames[0];
        const columnCount = Math.floor(Math.random() * 10) + 1;
        
        const newSchemaConfig = {
            [tableName]: Object.fromEntries([
                ["id", { type: "INTEGER PRIMARY KEY AUTOINCREMENT" as DataTypes }],
                ...Array.from({ length: columnCount }, () => {
                    const colName = generateValidTableName();
                    return [colName, { type: "TEXT NOT NULL" as DataTypes }];
                })
            ])
        };

        const newDb = new BunLiteDB(":memory:", newSchemaConfig);
        newDb.createTablesFromSchema();
        
        const schema = newDb.getSchema(tableName);
        expect(schema.length).toBe(columnCount + 1); // +1 for id column
        newDb.closeConnection();
    });

    test("fuzz test table names validation", () => {
        const invalidTableNames = [
            '123test',         // starts with number
            '.table',          // starts with period
            ';table',          // starts with a semicolon
            'test table',      // contains space
            'test-table',      // contains hyphen
            'table;drop',      // contains semicolon
            'table@test',      // contains special char
            'table.test',      // contains period
        ];

        for (const invalidName of invalidTableNames) {
            expect(() => {
                db.validateTableName(invalidName);
            }).toThrow();
        }
    });

    test("fuzz test record insertion with random data", () => {
        const tableName = testTableNames[0];
        const colName1 = generateValidTableName();
        const colName2 = generateValidTableName();
        
        const newSchemaConfig = {
            [tableName]: {
                id: { type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
                [colName1]: { type: "TEXT" },
                [colName2]: { type: "INTEGER" }
            }
        } as const;

        type Schema = typeof newSchemaConfig;
        const newDb = new BunLiteDB<Schema>(":memory:", newSchemaConfig);
        newDb.createTablesFromSchema();

        const recordCount = Math.floor(Math.random() * 50) + 1;
        
        for (let i = 0; i < recordCount; i++) {
            const record = {
                [colName1]: generateRandomString(10) as any, // to appease the type gods
                [colName2]: Math.floor(Math.random() * 1000)
            } as const;

            expect(() => {
                newDb.insertRecord(tableName, record);
            }).not.toThrow();
        }

        const records = newDb.fetchAllRecords(tableName);
        expect(records.length).toBe(recordCount);
        newDb.closeConnection();
    });

    test("fuzz test multiple table operations", () => {
        for (const tableName of testTableNames) {
            const colName = generateValidTableName();
            const newSchemaConfig = {
                [tableName]: {
                    id: { type: "INTEGER PRIMARY KEY AUTOINCREMENT" as DataTypes },
                    [colName]: { type: "TEXT" as DataTypes }
                }
            };

            const newDb = new BunLiteDB(":memory:", newSchemaConfig);
            newDb.createTablesFromSchema();

            expect(() => {
                newDb.insertRecord(tableName, {
                    [colName]: generateRandomString(10) as any
                });
                const records = newDb.fetchAllRecords(tableName);
                expect(records.length).toBe(1);
                newDb.deleteTable(tableName);
            }).not.toThrow();

            newDb.closeConnection();
        }
    });
});
