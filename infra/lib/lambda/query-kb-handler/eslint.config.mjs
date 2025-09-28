// @ts-check

import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.recommended,
    {
        rules: {
            'no-extra-semi': 'error',
            'semi': ['error', 'never'],
            indent: ['error', 4],
            quotes: ['error', 'single'],
        },
    },    
)
