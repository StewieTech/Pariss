// Load local .env for tests so process.env values are available to Jest
try {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	require('dotenv').config();
} catch (e) {
	// dotenv might not be installed in some environments; ignore if so
}

// Define React Native global used in some libraries
(global as any).__DEV__ = true;
import '@testing-library/jest-native/extend-expect';
