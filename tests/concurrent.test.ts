import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import BunLiteDB from '../src/index';

describe("Concurrent Operations", () => {
    const schemaConfig = {
        Counter: {
            id: { type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
            value: { type: "INTEGER NOT NULL" }
        },
        Log: {
            id: { type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
            message: { type: "TEXT NOT NULL" },
            timestamp: { type: "INTEGER NOT NULL" }
        }
    } as const;

    let db: BunLiteDB<typeof schemaConfig>;

    beforeEach(() => {
        db = new BunLiteDB(":memory:", schemaConfig);
        db.createTablesFromSchema();
    });

    afterEach(() => {
        db.closeConnection();
    });

    test("parallel inserts", async () => {
        const insertCount = 100;
        const promises = Array(insertCount).fill(0).map((_, i) => {
            return new Promise<void>((resolve) => {
                db.insertRecord("Counter", { value: 1});
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
                results[index] = [...results[index], Number(record.value)];
            }
        });

        await Promise.all(iteratorPromises);
        
        results.forEach(result => {
            expect(result.length).toBe(1000);
        });
    });

    test("concurrent filtered reads", async () => {
        const operations = 50;
        const timestamp = Date.now();

        // Insert test data
        await Promise.all(Array(operations).fill(0).map((_, i) => {
            return new Promise<void>((resolve) => {
                db.insertRecord("Log", {
                    message: `Operation ${i % 2 === 0 ? 'even' : 'odd'}`,
                    timestamp
                });
                resolve();
            });
        }));

        // Test concurrent filtered reads
        const promises = [
            // Read even operations
            Promise.all(Array(10).fill(0).map(() => {
                return new Promise<void>((resolve) => {
                    const evenLogs = db.fetchRecordsWithCondition(
                        "Log",
                        "message = ?",
                        ["Operation even"]
                    );
                    expect(evenLogs.length).toBe(Math.ceil(operations / 2));
                    resolve();
                });
            })),
            // Read odd operations
            Promise.all(Array(10).fill(0).map(() => {
                return new Promise<void>((resolve) => {
                    const oddLogs = db.fetchRecordsWithCondition(
                        "Log",
                        "message = ?",
                        ["Operation odd"]
                    );
                    expect(oddLogs.length).toBe(Math.floor(operations / 2));
                    resolve();
                });
            }))
        ];

        await Promise.all(promises.flat());
    });

    test("parallel filtered iteration", async () => {
        for (let i = 0; i < 1000; i++) {
            db.insertRecord("Counter", { value: i });
        }

        const iteratorPromises = [
            // Iterate over even values
            (async () => {
                let count = 0;
                for await (const record of db.recordsIterator(
                    "Counter",
                    100,
                    "value % 2 = 0",
                    []
                )) {
                    expect(record.value as number % 2).toBe(0);
                    count++;
                }
                expect(count).toBe(500); // Half of 1000
            })(),
            // Iterate over odd values
            (async () => {
                let count = 0;
                for await (const record of db.recordsIterator(
                    "Counter",
                    100,
                    "value % 2 = 1",
                    []
                )) {
                    expect(record.value as number % 2).toBe(1);
                    count++;
                }
                expect(count).toBe(500); // Half of 1000
            })()
        ];

        await Promise.all(iteratorPromises);
    });
});

describe("Multi-Instance Concurrent Operations", () => {
    const schemaConfig = {
        Counter: {
            id: { type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
            value: { type: "INTEGER NOT NULL" }
        },
        Log: {
            id: { type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
            message: { type: "TEXT NOT NULL" },
            timestamp: { type: "INTEGER NOT NULL" }
        }
    } as const;

    const dbPath = "test_concurrent.db";
    let instances: BunLiteDB<typeof schemaConfig>[] = [];

    beforeEach(() => {
        for (let i = 0; i < 3; i++) {
            const db = new BunLiteDB(dbPath, schemaConfig);
            if (i === 0) {
                db.createTablesFromSchema();
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
