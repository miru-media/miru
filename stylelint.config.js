export default {
  extends: [
    'stylelint-config-css-modules',
    'stylelint-config-html/html',
    'stylelint-config-recess-order',
    'stylelint-config-standard-scss',
  ],
  plugins: ['stylelint-prettier'],
  rules: {
    'prettier/prettier': true,
    'no-descending-specificity': null,
    'declaration-empty-line-before': null,
    'selector-class-pattern': null,
    'import-notation': 'url',
    'scss/load-partial-extension': null,
    'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global'] }],
    'property-no-unknown': [true, { ignoreProperties: ['composes'] }],
    'value-keyword-case': ['lower', { ignoreProperties: ['composes'] }],
  },
  ignorePath: ['.gitignore'],
}
