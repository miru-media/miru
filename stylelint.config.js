export default {
  extends: [
    'stylelint-config-css-modules',
    'stylelint-config-html/html',
    'stylelint-config-recess-order',
    'stylelint-config-standard',
  ],
  rules: {
    'declaration-empty-line-before': null,
    'selector-class-pattern': null,
    'at-rule-no-unknown': [true, { ignoreAtRules: ['unocss'] }],
  },
  ignoreFiles: ['dist'],
}
