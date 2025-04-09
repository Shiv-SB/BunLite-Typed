import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import BunLiteDB from '../src/index';

type ConcurrentTestSchema = {
    Counter: {
        id: number;
        value: number;
    };
    Log: {
        id: number;
        message: string;
        timestamp: number;
    };
};

describe("Concurrent Operations", () => {
    let db: BunLiteDB<ConcurrentTestSchema>;

    beforeEach(() => {
        db = new BunLiteDB(":memory:", ["Counter", "Log"]);
        db.createTable("Counter", [
            { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
            { name: "value", type: "INTEGER NOT NULL" }
        ]);
        db.createTable("Log", [
            { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
            { name: "message", type: "TEXT NOT NULL" },
            { name: "timestamp", type: "INTEGER NOT NULL" }
        ]);
    });

    afterEach(() => {
        db.closeConnection();
    });

    test("parallel inserts", async () => {
        const insertCount = 100;
        const promises = Array(insertCount).fill(0).map((_, i) => {
            return new Promise<void>((resolve) => {
                db.insertRecord("Counter", { value: i });
                resolve();
            });
        });

        await Promise.all(promises);
        const records = db.fetchAllRecords("Counter");
        expect(records.length).toBe(insertCount);
    });

    test("concurrent reads and writes", async () => {
        const operations = 50;
        const promises = Array(operations).fill(0).map((_, i) => {
            return new Promise<void>((resolve) => {
                db.insertRecord("Log", {
                    message: `Operation ${i}`,
                    timestamp: Date.now()
                });
                const logs = db.fetchAllRecords("Log");
                expect(logs.length).toBeGreaterThan(0);
                resolve();
            });
        });

        await Promise.all(promises);
        const finalLogs = db.fetchAllRecords("Log");
        expect(finalLogs.length).toBe(operations);
    });

    test("parallel record iteration", async () => {
        for (let i = 0; i < 1000; i++) {
            db.insertRecord("Counter", { value: i });
        }

        const iteratorCount = 3;
        const results: number[][] = Array(iteratorCount).fill([]);
        
        const iteratorPromises = Array(iteratorCount).fill(0).map(async (_, index) => {
            for await (const record of db.recordsIterator("Counter", 100)) {
                results[index] = [...results[index], record.value];
            }
        });

        await Promise.all(iteratorPromises);
        
        results.forEach(result => {
            expect(result.length).toBe(1000);
        });
    });
});

describe("Multi-Instance Concurrent Operations", () => {
    const dbPath = "test_concurrent.db";
    let instances: BunLiteDB<ConcurrentTestSchema>[] = [];

    beforeEach(() => {
        for (let i = 0; i < 3; i++) {
            const db = new BunLiteDB<ConcurrentTestSchema>(dbPath, ["Counter", "Log"]);
            if (i === 0) {
                db.createTable("Counter", [
                    { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
                    { name: "value", type: "INTEGER NOT NULL" }
                ]);
                db.createTable("Log", [
                    { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
                    { name: "message", type: "TEXT NOT NULL" },
                    { name: "timestamp", type: "INTEGER NOT NULL" }
                ]);
            }
            instances.push(db);
        }
    });

    afterEach(async () => {
        instances.forEach(db => db.closeConnection());
        instances = [];
        try {
            await Bun.file(dbPath).delete();
        } catch (error) {
            console.error("Failed to delete test database:", error);
        }
    });

    test("concurrent writes from multiple instances", async () => {
        const insertsPerInstance = 50;
        const promises = instances.map((db, dbIndex) => {
            return Promise.all(
                Array(insertsPerInstance).fill(0).map((_, i) => {
                    return new Promise<void>((resolve) => {
                        db.insertRecord("Counter", { value: dbIndex * 1000 + i });
                        resolve();
                    });
                })
            );
        });

        await Promise.all(promises.flat());
        const totalRecords = instances[0].fetchAllRecords("Counter");
        expect(totalRecords.length).toBe(insertsPerInstance * instances.length);
    });

    test("concurrent reads and writes from multiple instances", async () => {
        const operations = 30;
        const promises = instances.map((db, dbIndex) => {
            return Promise.all(
                Array(operations).fill(0).map((_, i) => {
                    return new Promise<void>((resolve) => {
                        db.insertRecord("Log", {
                            message: `Instance ${dbIndex} - Operation ${i}`,
                            timestamp: Date.now()
                        });
                        const logs = db.fetchAllRecords("Log");
                        expect(logs.length).toBeGreaterThan(0);
                        resolve();
                    });
                })
            );
        });

        await Promise.all(promises.flat());
        const finalLogs = instances[0].fetchAllRecords("Log");
        expect(finalLogs.length).toBe(operations * instances.length);
    });
});
