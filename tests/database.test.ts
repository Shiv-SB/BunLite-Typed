import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import BunLiteDB, { SQLError } from '../src/index';

const schemaConfig = {
    Users: {
        id: { type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
        name: { type: "TEXT NOT NULL" },
        email: { type: "TEXT UNIQUE" }
    },
    Posts: {
        id: { type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
        userId: { 
            type: "INTEGER NOT NULL",
            foreignKey: "REFERENCES Users(id) ON DELETE CASCADE"
        },
        title: { type: "TEXT NOT NULL" },
        content: { type: "TEXT" }
    }
} as const;

describe("SQLError", () => {
    test("should create SQLError with correct name and message", () => {
        const errorMessage = "Test SQL error";
        const error = new SQLError(errorMessage);
        
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe("SQLError");
        expect(error.message).toBe(errorMessage);
    });
});

describe("BunLiteDB", () => {
    let db: BunLiteDB<typeof schemaConfig>;

    beforeEach(() => {
        db = new BunLiteDB(":memory:", schemaConfig);
        db.createTablesFromSchema();
    });

    afterEach(() => {
        db.closeConnection();
    });

    test("database initialization", () => {
        expect(db).toBeDefined();
        expect(db.database).toBeDefined();
    });

    test("getExistingTableNames returns correct table names", () => {
        // @ts-ignore - accessing private method for testing
        const tableNames = db.getExistingTableNames();
        expect(tableNames).toContain("Users");
        expect(tableNames).toContain("Posts");
        expect(tableNames.length).toBe(2);
    });

    test("create table", () => {
        const schema = db.getSchema("Users");
        expect(schema.length).toBe(3);
    });

    test("insert and fetch records", () => {
        db.insertRecord("Users", {
            name: "Test User",
            email: "test@example.com"
        });

        const records = db.fetchAllRecords("Users");
        expect(records.length).toBe(1);
        const firstRecord = records[0];
        expect(firstRecord.name).toBe("Test User");
        expect(firstRecord.email).toBe("test@example.com");
    });

    test("upsert records", () => {
        db.upsertRecord("Users", {
            name: "Test User",
            email: "test@example.com"
        }, "email");

        db.upsertRecord("Users", {
            name: "Updated User",
            email: "test@example.com"
        }, "email");

        const records = db.fetchAllRecords("Users");
        expect(records.length).toBe(1);
        const firstRecord = records[0];
        expect(firstRecord.name).toBe("Updated User");
    });

    test("fetch records with condition", () => {
        db.insertRecord("Users", { name: "User 1", email: "user1@example.com" });
        db.insertRecord("Users", { name: "User 2", email: "user2@example.com" });

        const records = db.fetchRecordsWithCondition(
            "Users",
            "name = ?",
            ["User 1"]
        );

        expect(records.length).toBe(1);
        const firstRecord = records[0];
        expect(firstRecord?.email).toBe("user1@example.com");
    });

    test("delete table", () => {
        db.deleteTable("Users");
        
        expect(() => db.getSchema("Users")).toThrow();
    });

    test("foreign key constraints", () => {
        db.setForeignKeyMode("ON");

        db.insertRecord("Users", { name: "Test User" });
        const users = db.fetchAllRecords("Users");
        
        if (users.length === 0 || !users[0]?.id) {
            throw new Error("Failed to create user record");
        }

        db.insertRecord("Posts", {
            userId: users[0].id,
            title: "Test Post",
            content: "Test Content"
        });

        const posts = db.fetchAllRecords("Posts");
        expect(posts.length).toBe(1);
        const firstPost = posts[0];
        expect(firstPost?.userId).toBe(users[0].id);
    });

    test("record count operations", () => {
        // Insert some test records
        db.insertRecord("Users", { name: "User 1", email: "user1@example.com" });
        db.insertRecord("Users", { name: "User 2", email: "user2@example.com" });
        db.insertRecord("Users", { name: "User 3", email: "user3@example.com" });

        // Test total count
        expect(db.getRecordCount("Users")).toBe(3);

        // Test count with condition
        const count = db.getRecordCount("Users", "name LIKE ?", ["User 2"]);
        expect(count).toBe(1);

        // Test for no results
        const emptyCount = db.getRecordCount("Users", "name LIKE ?", ["foo"]);
        expect(emptyCount).toBe(0);
    });
});

