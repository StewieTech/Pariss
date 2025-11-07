import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env early
let result = dotenv.config();
// If dotenv didn't find a .env in the current working directory, try a couple of likely paths
if (!result.parsed) {
	try {
		const tryPaths = [
			path.resolve(process.cwd(), '.env'), // current working dir fallback
			path.resolve(__dirname, '../../.env'), // repo root when executing compiled code from /dist
		];
		for (const p of tryPaths) {
			if (fs.existsSync(p)) {
				result = dotenv.config({ path: p });
				break;
			}
		}
	} catch (e) {
		// ignore and continue; we'll log status below
	}
}

// Helpful debug: print whether important env keys were loaded (masked) so developers can see
// why a missing key error occurs without printing secrets in full.
const mask = (v?: string) => (v ? `${v.slice(0, 4)}...${v.slice(-4)}` : '<<not set>>');
try {
	const eleven = process.env.ELEVEN_API_KEY;
	// If dotenv didn't find a file, result.parsed will be undefined. We still check process.env
	if (!eleven) {
		// Only print a concise warning to the console; avoid throwing here so server can still run
		// (the route handler will return an error when the key is required).
		// Developers: restart the server after editing .env and ensure the process is started from the project root.
		// Example: $env:ELEVEN_API_KEY = 'sk-...'; npm run dev
		// For CI/deploy, make sure the environment variable is configured in your service.
		// Log a small warning for dev visibility.
		// eslint-disable-next-line no-console
		console.warn('Warning: ELEVEN_API_KEY not found in environment (dotenv loaded: ' + Boolean(result.parsed) + ').');
	} else {
		// eslint-disable-next-line no-console
		console.info('ELEVEN_API_KEY loaded (masked):', mask(eleven));
	}
} catch (e) {
	// eslint-disable-next-line no-console
	console.warn('env loader check failed', e);
}

export default {};
