
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	export interface AppTypes {
		RouteId(): "/" | "/api" | "/api/agent" | "/api/agent/clear" | "/api/agent/sessions" | "/api/agent/session" | "/api/agent/snapshot" | "/api/agent/title" | "/api/auth" | "/api/auth/device" | "/api/auth/device/status" | "/api/auth/pair" | "/api/auth/pair/status" | "/api/fs" | "/api/fs/delete" | "/api/fs/list" | "/api/fs/metadata" | "/api/fs/read" | "/api/fs/search" | "/api/fs/write" | "/api/health";
		RouteParams(): {
			
		};
		LayoutParams(): {
			"/": Record<string, never>;
			"/api": Record<string, never>;
			"/api/agent": Record<string, never>;
			"/api/agent/clear": Record<string, never>;
			"/api/agent/sessions": Record<string, never>;
			"/api/agent/session": Record<string, never>;
			"/api/agent/snapshot": Record<string, never>;
			"/api/agent/title": Record<string, never>;
			"/api/auth": Record<string, never>;
			"/api/auth/device": Record<string, never>;
			"/api/auth/device/status": Record<string, never>;
			"/api/auth/pair": Record<string, never>;
			"/api/auth/pair/status": Record<string, never>;
			"/api/fs": Record<string, never>;
			"/api/fs/delete": Record<string, never>;
			"/api/fs/list": Record<string, never>;
			"/api/fs/metadata": Record<string, never>;
			"/api/fs/read": Record<string, never>;
			"/api/fs/search": Record<string, never>;
			"/api/fs/write": Record<string, never>;
			"/api/health": Record<string, never>
		};
		Pathname(): "/" | "/api" | "/api/" | "/api/agent" | "/api/agent/" | "/api/agent/clear" | "/api/agent/clear/" | "/api/agent/sessions" | "/api/agent/sessions/" | "/api/agent/session" | "/api/agent/session/" | "/api/agent/snapshot" | "/api/agent/snapshot/" | "/api/agent/title" | "/api/agent/title/" | "/api/auth" | "/api/auth/" | "/api/auth/device" | "/api/auth/device/" | "/api/auth/device/status" | "/api/auth/device/status/" | "/api/auth/pair" | "/api/auth/pair/" | "/api/auth/pair/status" | "/api/auth/pair/status/" | "/api/fs" | "/api/fs/" | "/api/fs/delete" | "/api/fs/delete/" | "/api/fs/list" | "/api/fs/list/" | "/api/fs/metadata" | "/api/fs/metadata/" | "/api/fs/read" | "/api/fs/read/" | "/api/fs/search" | "/api/fs/search/" | "/api/fs/write" | "/api/fs/write/" | "/api/health" | "/api/health/";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): string & {};
	}
}