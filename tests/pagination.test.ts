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
            id: { type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
            name: { type: "TEXT NOT NULL" },
            email: { type: "TEXT UNIQUE" }
        }
    } as const;

    let db: BunLiteDB<typeof schemaConfig>;

    const createTestUsers = (count: number): Array<Omit<TestSchema['Users'], 'id'>> => 
        Array.from({ length: count }, (_, i) => ({
            name: `User ${i + 1}`,
            email: `user${i + 1}@example.com`
        }));

    beforeEach(() => {
        db = new BunLiteDB(":memory:", schemaConfig);
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

    test("pagination with conditions", () => {
        const users = createTestUsers(100);
        users.forEach(user => db.insertRecord("Users", user));

        // Test pagination with WHERE clause
        const evenUsers = db.fetchRecordsWithPagination(
            "Users", 
            1, 
            10, 
            "id % 2 = 0",
            []
        );
        expect(evenUsers.every(user => user.id! as number % 2 === 0)).toBe(true);

        // Test pagination with parameterized query
        const nameFilter = db.fetchRecordsWithPagination(
            "Users",
            1,
            10,
            "name LIKE ?",
            ["User 1%"]
        );
        expect(nameFilter.every(user => user.name.startsWith("User 1"))).toBe(true);
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

    test("iterator with conditions", async () => {
        const userCount = 100;
        const users = createTestUsers(userCount);
        users.forEach(user => db.insertRecord("Users", user));

        // Test iterator with WHERE clause
        let evenCount = 0;
        for await (const record of db.recordsIterator(
            "Users",
            10,
            "id % 2 = 0",
            []
        )) {
            expect(record.id! as number % 2).toBe(0);
            evenCount++;
        }
        expect(evenCount).toBe(Math.floor(userCount / 2));

        // Test iterator with parameterized query
        let filteredCount = 0;
        for await (const record of db.recordsIterator(
            "Users",
            10,
            "name LIKE ?",
            ["User 1%"]
        )) {
            expect(record.name.startsWith("User 1")).toBe(true);
            filteredCount++;
        }
        expect(filteredCount).toBeGreaterThan(0);
    });
});
