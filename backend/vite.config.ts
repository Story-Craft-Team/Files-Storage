import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
	build: {
		target: "node20",
		ssr: false,
		lib: {
			entry: resolve(__dirname, "src/index.ts"),
			name: "backend",
			fileName: "index",
			formats: ["cjs"],
		},
		rollupOptions: {
			external: [
				"cloudflare:sockets",
				/^node:/,
				"http",
				"https",
				"stream",
				"util",
				"path",
				"fs",
				"net",
				"tls",
				"zlib",
				"events",
				"buffer",
				"url",
				"os",
				"crypto",
				"child_process",
				"dns",
				"querystring",
				"timers",
			],
			output: {
				inlineDynamicImports: true,
			},
		},
		outDir: "dist",
		emptyOutDir: false,
		minify: false,
		sourcemap: true,
	},
	resolve: {
		alias: {
			"@": resolve(__dirname, "src"),
			"@classfields": resolve(__dirname, "src/classfields.ts"),
			"@modules": resolve(__dirname, "src/modules"),
		},
	},
	esbuild: {
		keepNames: true,
	},
	appType: "custom",
	optimizeDeps: {
		disabled: true,
	},
});
