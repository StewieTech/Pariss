module.exports = {
  preset: 'ts-jest',
  // Use jsdom so react-native testing-library can work in Node environment
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  // Allow transforming react-native and some testing libs inside node_modules
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@testing-library|@react-navigation|@unimodules|expo|@expo)/)'
  ],
  testMatch: ['**/__tests__/**/*.test.(ts|tsx|js)'],
  testPathIgnorePatterns: ['<rootDir>/dist/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Provide mappings for assets and map react-native to our manual mock to avoid heavy native dependencies in Jest
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
    '^react-native/Libraries/Utilities/Platform$': 'react-native/Libraries/Utilities/Platform.android.js'
  },
};
