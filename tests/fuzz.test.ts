import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import BunLiteDB, { DataTypes } from '../src/index';

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
    let db: BunLiteDB<string, Record<string, Record<string, unknown>>>;
    let testTableNames: string[];

    beforeEach(() => {
        testTableNames = Array.from({ length: 5 }, generateValidTableName);
        db = new BunLiteDB(":memory:", testTableNames);
    });

    afterEach(() => {
        db.closeConnection();
    });

    test("fuzz test table creation with random column names", () => {
        const tableName = testTableNames[0];
        const columnCount = Math.floor(Math.random() * 10) + 1; // 1-10 columns
        
        const columns = Array.from({ length: columnCount }, () => ({
            name: generateValidTableName(),
            type: "TEXT NOT NULL" as DataTypes
        }));

        expect(() => {
            db.createTable(tableName, columns);
            const schema = db.getSchema(tableName);
            expect(schema.length).toBe(columnCount);
        }).not.toThrow();
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
        const columns = [
            { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT" as DataTypes },
            { name: generateValidTableName(), type: "TEXT" as DataTypes },
            { name: generateValidTableName(), type: "INTEGER" as DataTypes }
        ];

        db.createTable(tableName, columns);

        const recordCount = Math.floor(Math.random() * 50) + 1;
        
        for (let i = 0; i < recordCount; i++) {
            const record = {
                [columns[1].name]: generateRandomString(10),
                [columns[2].name]: Math.floor(Math.random() * 1000)
            };

            expect(() => {
                db.insertRecord(tableName, record);
            }).not.toThrow();
        }

        const records = db.fetchAllRecords(tableName);
        expect(records.length).toBe(recordCount);
    });

    test("fuzz test multiple table operations", () => {
        for (const tableName of testTableNames) {
            const columns = [
                { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT" as DataTypes },
                { name: generateValidTableName(), type: "TEXT" as DataTypes}
            ];

            expect(() => {
                db.createTable(tableName, columns);
                db.insertRecord(tableName, {
                    [columns[1].name]: generateRandomString(10)
                });
                const records = db.fetchAllRecords(tableName);
                expect(records.length).toBe(1);
                db.deleteTable(tableName);
            }).not.toThrow();
        }
    });
});
