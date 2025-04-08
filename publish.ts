import { $ } from "bun";
import readline from 'node:readline';
import packageJSON from "./package.json";

const npmRegistryDetails = await fetch("https://registry.npmjs.com/-/v1/search?text=bunlite-typed&size=20");
const npmVersion: string = (await npmRegistryDetails.json()).objects[0].package.version;

if (packageJSON.version === npmVersion) {
    console.warn(`${Bun.color("#ffd700", "ansi-16m")}    You've forgotten to bump the version in package.json!`);
    console.log(`${Bun.color("#00ffff", "ansi-16m")}    Running auto bumper`);
    
    console.log(`${Bun.color("#00ffff", "ansi-16m")}    Current Version in package.json: ${Bun.color("#ff00ff", "ansi-16m")}${packageJSON.version}`);

    const tempRl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
    let newVersion: string;
    
    do {
        newVersion = await new Promise<string>(resolve => 
            tempRl.question(`${Bun.color("#00ffff", "ansi-16m")}    Enter new version (semver format x.x.x): `, resolve)
        );
        
        if (!semverRegex.test(newVersion)) {
            console.warn(`${Bun.color("#ff0000", "ansi-16m")}    Invalid version format. Please use semantic versioning (e.g., 1.0.0)`);
            continue;
        }

        const versionComparison = Bun.semver.order(packageJSON.version, newVersion);
        if (versionComparison >= 0) {
            console.warn(`${Bun.color("#ff0000", "ansi-16m")}    New version must be greater than current version ${packageJSON.version}`);
            continue;
        }
    } while (!semverRegex.test(newVersion) || Bun.semver.order(packageJSON.version, newVersion) >= 0);
    
    tempRl.close();
    
    const packagePath = new URL('./package.json', import.meta.url);
    const updatedPackage = { ...packageJSON, version: newVersion };
    await Bun.write(packagePath, JSON.stringify(updatedPackage, null, 2));
    
    console.log(`${Bun.color("#00ff00", "ansi-16m")}Updated package.json version to ${Bun.color("#ff00ff", "ansi-16m")}${newVersion}`);
    
    process.stdout.write('\x1b[0m');
}

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