import BunLiteDB, { DataTypes } from "../src";
import { expect, test, describe } from "bun:test";

type TestSchema = {
    PerformanceTest: {
        id: number;
        data: string;
        timestamp: number;
    }
};

const format = (x: number): string => x.toLocaleString("en-GB", { maximumFractionDigits: 0 });

const generateTestData = (count: number, offset: number = 0): Array<Omit<TestSchema['PerformanceTest'], 'id'>> =>
    Array.from({ length: count }, (_, i) => ({
        data: `Test data ${i + offset}`.padEnd(100, '*'),
        timestamp: Date.now()
    }));

const drawSpeedBar = (recordsPerSec: number, color: string = "\x1b[32m", maxSpeed: number = 2_000_000): void => {
    const width = 40;
    const blocks = ["▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"];
    const percent = Math.min(recordsPerSec / maxSpeed, 1);
    const filled = Math.floor(width * percent);
    const partial = Math.floor((percent * width * blocks.length) % blocks.length);

    console.log(`${color}[${"█".repeat(filled)}${partial > 0 ? blocks[partial - 1] : ""}${" ".repeat(Math.max(0, width - filled - (partial > 0 ? 1 : 0)))}] ${format(recordsPerSec)} records/sec\x1b[0m`);
};

describe("Performance Tests", () => {
    const schemaConfig = {
        PerformanceTest: {
            id: { type: "INTEGER PRIMARY KEY" as DataTypes },
            data: { type: "TEXT" as DataTypes },
            timestamp: { type: "INTEGER" as DataTypes }
        }
    };

    const db = new BunLiteDB<TestSchema>(":memory:", schemaConfig);

    test("Bulk Insert Performance", async () => {
        db.createTablesFromSchema();

        const recordCounts = [1000, 10000, 100000];
        let currentOffset = 0;

        for (const count of recordCounts) {
            const testData = generateTestData(count, currentOffset);
            console.log(`\nTesting ${count} records insertion:`);

            const startTime = performance.now();
            let processed = 0;


            for (const record of testData) {
                db.insertRecord("PerformanceTest", record);
                processed++;

                if (processed % Math.floor(count / 4) === 0) {
                    drawSpeedBar(processed / ((performance.now() - startTime) / 1000), "\x1b[35m", 500_000);
                }
            }

            currentOffset += count;
            const duration = performance.now() - startTime;
            console.log(`\x1b[36m✓ Inserted ${count} records in ${duration.toFixed(2)}ms (${format(count / (duration / 1000))} records/sec)\x1b[0m`);

            const actualCount = db.fetchRecordsWithCondition("PerformanceTest", "id <= ?", [currentOffset]).length;
            expect(actualCount).toBe(currentOffset);

        }
    });

    test("Bulk Read Performance", async () => {
        const batchSizes = [1000, 10000, 100000];

        for (const size of batchSizes) {
            console.log(`\nTesting ${size} records retrieval:`);

            const startTime = performance.now();
            let records: Record<string, any>[] = [];

            for await (const record of db.recordsIterator("PerformanceTest", size)) {
                records.push(record);
                if (records.length % Math.floor(size / 4) === 0) {
                    const currentTime = performance.now();
                    const elapsedTime = currentTime - startTime;
                    const speed = (records.length / (elapsedTime / 1000));
                    drawSpeedBar(speed, "\x1b[35m");
                }
            }

            const duration = performance.now() - startTime;
            console.log(`\x1b[36m✓ Retrieved ${records.length} records in ${duration.toFixed(2)}ms (${format(records.length / (duration / 1000))} records/sec)\x1b[0m`);

            expect(records.length).toBeGreaterThan(0);
        }
    });
});
