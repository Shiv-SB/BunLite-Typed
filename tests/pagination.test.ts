import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import BunLiteDB from '../src/index';

type TestSchema = {
    Users: {
        id: number;
        name: string;
        email: string;
    };
};

describe("BunLiteDB Pagination", () => {
    let db: BunLiteDB<TestSchema>;

    function createTestUsers(count: number): {
        name: string;
        email: string;
    }[] {
        return Array.from({ length: count }, (_, i) => ({
            name: `User ${i + 1}`,
            email: `user${i + 1}@example.com`
        }));
    }

    beforeEach(() => {
        db = new BunLiteDB(":memory:", ["Users"]);
    });

    afterEach(() => {
        db.closeConnection();
    });

    test("pagination", () => {
        db.createTable("Users", [
            { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
            { name: "name", type: "TEXT NOT NULL" },
            { name: "email", type: "TEXT UNIQUE" }
        ]);

        const userCount = 500 * 100;
        const pageSize = 16;
        const totalPages = Math.ceil(userCount / pageSize);
        const testUsers = createTestUsers(userCount);
        testUsers.forEach(user => db.insertRecord("Users", user));

        const firstPage = db.fetchRecordsWithPagination("Users", 1, pageSize);
        expect(firstPage.length).toBe(Math.min(pageSize, userCount));
        expect(firstPage[0].name).toBe(`User ${1}`);
        expect(firstPage[firstPage.length - 1].name).toBe(`User ${Math.min(pageSize, userCount)}`);

        // Test middle page (if applicable)
        if (totalPages > 2) {
            const middlePage = db.fetchRecordsWithPagination("Users", 2, pageSize);
            const middlePageStart = pageSize + 1;
            expect(middlePage.length).toBe(Math.min(pageSize, userCount - pageSize));
            expect(middlePage[0].name).toBe(`User ${middlePageStart}`);
            expect(middlePage[middlePage.length - 1].name)
                .toBe(`User ${Math.min(middlePageStart + pageSize - 1, userCount)}`);
        }

        const lastPage = db.fetchRecordsWithPagination("Users", totalPages, pageSize);
        const lastPageSize = userCount % pageSize || pageSize;
        const lastPageStart = ((totalPages - 1) * pageSize) + 1;
        expect(lastPage.length).toBe(lastPageSize);
        expect(lastPage[0].name).toBe(`User ${lastPageStart}`);
        expect(lastPage[lastPage.length - 1].name).toBe(`User ${userCount}`);

        // Test invalid pages
        expect(() => db.fetchRecordsWithPagination("Users", 0, pageSize)).toThrow();
        expect(() => db.fetchRecordsWithPagination("Users", 1, 0)).toThrow();
    });

    test("iterator", async () => {
        db.createTable("Users", [
            { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
            { name: "name", type: "TEXT NOT NULL" },
            { name: "email", type: "TEXT UNIQUE" }
        ]);

        const userCount = 500;
        const defaultBatchSize = 1000;
        const smallBatchSize = 5;
        const largeBatchSize = 200;

        const testUsers = createTestUsers(userCount);
        testUsers.forEach(user => db.insertRecord("Users", user));

        let count = 0;
        for await (const record of db.recordsIterator("Users", defaultBatchSize)) {
            count++;
            expect(record.name).toBe(`User ${count}`);
            expect(record.email).toBe(`user${count}@example.com`);
        }
        expect(count).toBe(userCount);

        count = 0;
        for await (const record of db.recordsIterator("Users", smallBatchSize)) {
            count++;
            expect(record.name).toBe(`User ${count}`);
            expect(record.email).toBe(`user${count}@example.com`);
        }
        expect(count).toBe(userCount);

        count = 0;
        for await (const record of db.recordsIterator("Users", largeBatchSize)) {
            count++;
            expect(record.name).toBe(`User ${count}`);
            expect(record.email).toBe(`user${count}@example.com`);
        }
        expect(count).toBe(userCount);
    });
});
