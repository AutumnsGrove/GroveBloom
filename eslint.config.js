// ESLint flat config for Grove Bloom monorepo
// https://eslint.org/docs/latest/use/configure/configuration-files

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.svelte-kit/**",
      "**/.wrangler/**",
      "**/coverage/**",
    ],
  },
];
