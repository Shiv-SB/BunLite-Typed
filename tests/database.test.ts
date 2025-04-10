import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import BunLiteDB, { SQLError } from '../src/index';

type TestSchema = {
    Users: {
        id: number;
        name: string;
        email: string;
    };
    Posts: {
        id: number;
        userId: number;
        title: string;
        content: string;
    };
};

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
    let db: BunLiteDB<TestSchema>;

    beforeEach(() => {
        db = new BunLiteDB(":memory:", ["Users", "Posts"]);
    });

    afterEach(() => {
        db.closeConnection();
    });

    test("database initialization", () => {
        expect(db).toBeDefined();
        expect(db.database).toBeDefined();
    });

    test("getExistingTableNames returns correct table names", () => {
        db.createTable("Users", [
            { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
            { name: "name", type: "TEXT NOT NULL" }
        ]);

        db.createTable("Posts", [
            { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
            { name: "title", type: "TEXT NOT NULL" }
        ]);

        // @ts-ignore - accessing private method for testing
        const tableNames = db.getExistingTableNames();
        expect(tableNames).toContain("Users");
        expect(tableNames).toContain("Posts");
        expect(tableNames.length).toBe(2);
    });

    test("create table", () => {
        db.createTable("Users", [
            { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
            { name: "name", type: "TEXT NOT NULL" },
            { name: "email", type: "TEXT UNIQUE" }
        ]);

        const schema = db.getSchema("Users");
        expect(schema.length).toBe(3);
    });

    test("insert and fetch records", () => {
        db.createTable("Users", [
            { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
            { name: "name", type: "TEXT NOT NULL" },
            { name: "email", type: "TEXT UNIQUE" }
        ]);

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
        db.createTable("Users", [
            { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
            { name: "name", type: "TEXT NOT NULL" },
            { name: "email", type: "TEXT UNIQUE" }
        ]);

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
        db.createTable("Users", [
            { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
            { name: "name", type: "TEXT NOT NULL" },
            { name: "email", type: "TEXT UNIQUE" }
        ]);

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
        db.createTable("Users", [
            { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
            { name: "name", type: "TEXT NOT NULL" }
        ]);

        db.deleteTable("Users");
        
        expect(() => db.getSchema("Users")).toThrow();
    });

    test("foreign key constraints", () => {
        db.setForeignKeyMode("ON");
        
        db.createTable("Users", [
            { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
            { name: "name", type: "TEXT NOT NULL" }
        ]);

        db.createTable("Posts", [
            { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
            { name: "userId", type: "INTEGER", foreignKey: "REFERENCES Users(id)" },
            { name: "title", type: "TEXT NOT NULL" },
            { name: "content", type: "TEXT" }
        ]);

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
});

