import { $ } from "bun";
import readline from 'node:readline';

process.on('exit', () => {
    process.stdout.write('\x1b[0m');
});

let rl: readline.Interface | undefined;

try {
    const whoami = $`bun pm whoami`;
    await $`echo "${Bun.color("#00ffff", "ansi-16m")}NPM current user: ${Bun.color("#00ff00", "ansi-16m")}${await whoami.text()}"`;

    console.log(`${Bun.color("#4169e1", "ansi-16m")}\n📦 Transpiling src file(s)...\n`);
    await $`bun run build`;

    console.log(`${Bun.color("#ff00ff", "ansi-16m")}\n🧪 Running test suite...\n\x1b[0m`);
    await $`bun test`;

    console.log(`${Bun.color("#ffd700", "ansi-16m")}\n🚀 Dry run publishing...\n`);
    await $`bun publish --dry-run`;

    console.log(`${Bun.color("#00ffff", "ansi-16m")}\n✨ If everything looks good, select yes below to publish to NPM!\n`);

    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    function askQuestion(query: string): Promise<string> {
        return new Promise(resolve => rl!.question(query, resolve));
    }

    console.log(`${Bun.color("#00ff00", "ansi-16m")}[Y] Yes  ${Bun.color("#ff0000", "ansi-16m")}[N] No`);
    const answer = await askQuestion(`${Bun.color("#00ffff", "ansi-16m")}Proceed with publishing? `);

    if (answer.toLowerCase() === 'y') {
        console.log(`${Bun.color("#00ff00", "ansi-16m")}\n📤 Publishing to NPM...\n`);
        await $`bun publish`;
        console.log(`${Bun.color("#00ff00", "ansi-16m")}✅ Package published successfully!\n`);
    } else {
        console.log(`${Bun.color("#ffd700", "ansi-16m")}\n❌ Publishing cancelled.\n`);
    }
} catch (error) {
    console.error(`${Bun.color("#ff0000", "ansi-16m")}Error: ${error.message}`);
    process.stdout.write('\x1b[0m');
} finally {
    if (rl) {
        process.stdout.write('\x1b[0m');
        rl.close();
    }
}