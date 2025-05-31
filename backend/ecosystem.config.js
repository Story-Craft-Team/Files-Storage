module.exports = {
	apps: [
		{
			name: "storage",
			script: "./index.js",
			instances: "max",
			autorestart: true,
			watch: false,
			max_memory_restart: "1G",
			env: {
				NODE_ENV: "production",
			},
			env_development: {
				NODE_ENV: "development",
			},
		},
	],
};
