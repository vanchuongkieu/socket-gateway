import js from '@eslint/js'
import pluginImport from 'eslint-plugin-import'
import unusedImports from 'eslint-plugin-unused-imports'
import prettier from 'eslint-config-prettier'

export default [
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.ts'],
    plugins: {
      import: pluginImport,
      'unused-imports': unusedImports,
    },
    rules: {
      'no-unused-vars': 'warn',
      'import/no-unresolved': 'off', // Bun resolver ok
      'unused-imports/no-unused-imports': 'error',
    },
  },
  prettier,
]
