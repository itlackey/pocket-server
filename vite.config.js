import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		// Support for the dev server
		port: 3000
	},
	define: {
		// Enable process.env for compatibility with existing code
		global: 'globalThis'
	}
});