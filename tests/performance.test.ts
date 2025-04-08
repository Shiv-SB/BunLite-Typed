import BunLiteDB from "../src";
import { expect, test, describe } from "bun:test";

type TestSchema = {
    PerformanceTest: {
        id: number;
        data: string;
        timestamp: number;
    }
};

function format(x: number): string {
    return x.toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

function generateTestData(count: number, offset: number = 0) {
    return Array.from({ length: count }, (_, i) => ({
        id: i + offset,
        data: `Test data ${i + offset}`.padEnd(100, '*'),
        timestamp: Date.now()
    }));
}

function drawSpeedBar(recordsPerSec: number, color: string = "\x1b[32m", maxSpeed: number = 2_000_000) {
    const width = 40;
    const blocks = ["▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"];
    const percent = recordsPerSec / maxSpeed;
    const filled = Math.max(0, Math.min(width - 1, Math.floor(width * percent)));
    const partial = Math.floor((percent * width * blocks.length) % blocks.length);
    const empty = width - filled - (partial > 0 ? 1 : 0);
    
    const bar = `${color}[${
        "█".repeat(filled)}${
        partial > 0 ? blocks[partial - 1] : ""}${
        " ".repeat(empty)}] ${format(recordsPerSec)} records/sec\x1b[0m`;
    console.log(bar);
}

describe("Performance Tests", () => {
    const db = new BunLiteDB<keyof TestSchema, TestSchema>(":memory:", ["PerformanceTest"]);

    test("Bulk Insert Performance", async () => {
        const recordCounts = [1000, 10000, 100000];
        let currentOffset = 0;
        
        db.createTable("PerformanceTest", [
            { name: "id", type: "INTEGER PRIMARY KEY" },
            { name: "data", type: "TEXT" },
            { name: "timestamp", type: "INTEGER" }
        ]);

        for (const count of recordCounts) {
            const testData = generateTestData(count, currentOffset);
            console.log(`\nTesting ${count} records insertion:`);
            
            const startTime = performance.now();
            let processed = 0;
            
            for (const record of testData) {
                db.insertRecord("PerformanceTest", record);
                processed++;
                
                if (processed % Math.floor(count / 4) === 0) {
                    const currentTime = performance.now();
                    const elapsedTime = currentTime - startTime;
                    const speed = (processed / (elapsedTime / 1000));
                    drawSpeedBar(speed, "\x1b[35m", 500_000);
                }
            }
            
            currentOffset += count;
            const duration = performance.now() - startTime;
            console.log(`\x1b[36m✓ Inserted ${count} records in ${duration.toFixed(2)}ms (${format(count / (duration / 1000))} records/sec)\x1b[0m`);
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
