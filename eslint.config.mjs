import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{ ignores: ["dist", "node_modules"] },
	{
		extends: [js.configs.recommended, ...tseslint.configs.recommended],
		files: ["**/*.{ts,tsx,js,mjs}"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
		plugins: {
			"react-hooks": reactHooks,
			"react-refresh": reactRefresh,
		},
		rules: {
			...reactHooks.configs.recommended.rules,
			"react-refresh/only-export-components": [
				"warn",
				{ allowConstantExport: true },
			],
			"@typescript-eslint/no-explicit-any": "warn",
		},
	},
	{
		files: ["features/**/*.{ts,tsx}", "shared/**/*.{ts,tsx}"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					patterns: [
						{
							group: ["@app/*", "app/*"],
							message:
								"Violación Arquitectónica: Las capas Shared y Features no pueden depender de App (top-level).",
						},
					],
				},
			],
		},
	},
	{
		files: ["shared/**/*.{ts,tsx}"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					patterns: [
						{
							group: ["@features/*", "features/*"],
							message:
								"Violación Arquitectónica: La capa Shared debe ser agnóstica y no puede depender de implementaciones de Features.",
						},
					],
				},
			],
		},
	},
);
