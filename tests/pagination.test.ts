import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import BunLiteDB, { DataTypes } from '../src/index';

type TestSchema = {
    Users: {
        id: number;
        name: string;
        email: string;
    };
};

describe("BunLiteDB Pagination", () => {
    const schemaConfig = {
        Users: {
            id: { type: "INTEGER PRIMARY KEY AUTOINCREMENT" as DataTypes },
            name: { type: "TEXT NOT NULL" as DataTypes },
            email: { type: "TEXT UNIQUE" as DataTypes }
        }
    };

    let db: BunLiteDB<TestSchema>;

    const createTestUsers = (count: number): Array<Omit<TestSchema['Users'], 'id'>> => 
        Array.from({ length: count }, (_, i) => ({
            name: `User ${i + 1}`,
            email: `user${i + 1}@example.com`
        }));

    beforeEach(() => {
        db = new BunLiteDB<TestSchema>(":memory:", schemaConfig);
        db.createTablesFromSchema();
    });

    afterEach(() => db.closeConnection());

    test("pagination edge cases", () => {
        expect(() => db.fetchRecordsWithPagination("Users", 0, 10)).toThrow();
        expect(() => db.fetchRecordsWithPagination("Users", -1, 10)).toThrow();
        expect(() => db.fetchRecordsWithPagination("Users", 1, 0)).toThrow();
        expect(() => db.fetchRecordsWithPagination("Users", 1, -1)).toThrow();
        
        const emptyResults = db.fetchRecordsWithPagination("Users", 1, 10);
        expect(emptyResults).toEqual([]);
    });

    test("pagination with various data sizes", () => {
        const testSizes = [16, 100, 500];

        for (const size of testSizes) {
            const users = createTestUsers(size);
            users.forEach(user => db.insertRecord("Users", user));

            const firstPage = db.fetchRecordsWithPagination("Users", 1, 16);
            expect(firstPage.length).toBe(16);
            expect(firstPage[0]).toEqual(expect.objectContaining({ name: "User 1" }));

            const lastPage = db.fetchRecordsWithPagination("Users", Math.ceil(size / 16), 16);
            expect(lastPage.length).toBe(size % 16 || 16);
            expect(lastPage[lastPage.length - 1]).toEqual(expect.objectContaining({ name: `User ${size}` }));

            db.deleteTable("Users");
            db.createTablesFromSchema();
        }
    });

    test("iterator with various batch sizes", async () => {
        const userCount = 500;
        const batchSizes = [1, 5, 100, 500, 1000];
        const users = createTestUsers(userCount);
        users.forEach(user => db.insertRecord("Users", user));

        for (const batchSize of batchSizes) {
            let count = 0;
            for await (const record of db.recordsIterator("Users", batchSize)) {
                count++;
                expect(record).toEqual(expect.objectContaining({
                    name: `User ${count}`,
                    email: `user${count}@example.com`
                }));
            }
            expect(count).toBe(userCount);
        }
    });
});
