
const baseConfig = require('./.eslintrc.json')

module.exports = {
  ...baseConfig,
  parser:  '@typescript-eslint/parser',
  extends: [
    "plugin:@typescript-eslint/recommended"
  ],
  rules: {
    ...baseConfig.rules,
    "@typescript-eslint/camelcase": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/explicit-member-accessibility": [
      "error",
      {
        "accessibility": "no-public",
        "overrides": {
          "parameterProperties": "off"
        }
      }
    ],
    "@typescript-eslint/indent": [
      "error",
      2,
      {
        "ArrayExpression": 1,
        "CallExpression": {
          "arguments": 1
        },
        "FunctionDeclaration": {
          "body": 1,
          "parameters": 1
        },
        "FunctionExpression": {
          "body": 1,
          "parameters": 1
        },
        "ImportDeclaration": 1,
        "MemberExpression": 1,
        "ObjectExpression": 1,
        "SwitchCase": 1,
        "VariableDeclarator": 1,
        "flatTernaryExpressions": false,
        "ignoreComments": false,
        "outerIIFEBody": 1
      }
    ],
    "@typescript-eslint/interface-name-prefix": "off",
    "@typescript-eslint/member-delimiter-style": [
      "error",
      {
        "multiline": {
          "delimiter": "comma",
          "requireLast": true
        },
        "singleline": {
          "delimiter": "comma",
          "requireLast": false
        }
      }
    ],
    "@typescript-eslint/no-empty-function": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-parameter-properties": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "args": "none",
        "ignoreRestSiblings": true,
        "vars": "all"
      }
    ],
    "@typescript-eslint/no-use-before-define": "off",
    "@typescript-eslint/no-useless-constructor": "error",
  },
}
