import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
	resolve: {
		alias: {
			$lib: resolve('./src/lib')
		}
	},
	test: {
		include: ['tests/**/*.test.{js,ts}'],
		exclude: ['tests/e2e/**/*.spec.{js,ts}'],
		environment: 'node',
		globals: true
	}
});