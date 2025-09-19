
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
		RouteId(): "/" | "/api" | "/api/auth" | "/api/auth/challenge" | "/api/auth/device" | "/api/auth/device/status" | "/api/auth/pair" | "/api/auth/pair/status" | "/api/auth/token" | "/api/health";
		RouteParams(): {
			
		};
		LayoutParams(): {
			"/": Record<string, never>;
			"/api": Record<string, never>;
			"/api/auth": Record<string, never>;
			"/api/auth/challenge": Record<string, never>;
			"/api/auth/device": Record<string, never>;
			"/api/auth/device/status": Record<string, never>;
			"/api/auth/pair": Record<string, never>;
			"/api/auth/pair/status": Record<string, never>;
			"/api/auth/token": Record<string, never>;
			"/api/health": Record<string, never>
		};
		Pathname(): "/" | "/api" | "/api/" | "/api/auth" | "/api/auth/" | "/api/auth/challenge" | "/api/auth/challenge/" | "/api/auth/device" | "/api/auth/device/" | "/api/auth/device/status" | "/api/auth/device/status/" | "/api/auth/pair" | "/api/auth/pair/" | "/api/auth/pair/status" | "/api/auth/pair/status/" | "/api/auth/token" | "/api/auth/token/" | "/api/health" | "/api/health/";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): string & {};
	}
}