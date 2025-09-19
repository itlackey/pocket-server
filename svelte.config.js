import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// Use Node.js adapter since this is a server application
		adapter: adapter(),
		files: {
			// Keep existing src structure for the application logic
			routes: 'src/routes',
			lib: 'src/lib'
		}
	}
};

export default config;