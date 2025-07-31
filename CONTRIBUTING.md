# Contributing guide

Thanks for your interest in Miru! Please help us keep the project open and inclusive following our [Code of Conduct](https://miru.media/code-of-conduct).

## License

Miru is licensed under the [AGPL-3.0-only](https://spdx.org/licenses/AGPL-3.0-only.html).

## Development

### Setup

We use the [`pnpm`](https://pnpm.io/) package manager. If you already have `npm` installed, you can can use it to install <code><b>p</b>npm</code> by running <code>npm&nbsp;install&nbsp;--global&nbsp;pnpm`</code>. For other install methods, follow [pnpm's installation guide](https://pnpm.io/installation).

When you have `pnpm`, use it to install the project's dependencies and start the [Vite](https://vite.dev/) development server.

```sh
pnpm install
pnpm run dev
```

When the development server is started, it should show you a `localhost` URL. Open that URL in your web browser to see your local version of the website. When you edit files in the repo, you should see the changes automatically applied in your browser.

## Testing on mobiles or other devices

To test on other devices, your need to run the dev command with the argument `--host` so that the server is open to outside connections. Browsers disable some features such as camera access when the protocol isn't `https:`. The dev script will use [vite-plugin-basic-ssl](https://github.com/vitejs/vite-plugin-basic-ssl) if you set the environment variable `BASIC_SSL=1`.

```sh
BASIC_SSL=1 pnpm dev --host
```

## Building

We use [Rollup](https://rollupjs.org/) to build our published libraries and Vite to build the webste.

```sh
pnpm run libs:build
pnpm run docs:build
```

## Project structure

We use a monorepo structure with public internal packages in the `packages/` directory, and the source code of the project website in the `docs/` directory. For development and building, there are also some scripts in the `scripts/` directory.

```text
packages/
    sahred/
    media-trimmer/
    webgl-video-editor/
    gltf-ar-effects/
    ...
docs/
    index.md
    demos.md
    ar-effects.md
    video-editor-demo/
    ...
scripts/
    auto-import-options.js
    glob-import-frag.js
    release.js
    ...
```

## Code quality

Most of the project is written in [TypeScript](https://www.typescriptlang.org/). To help maintaining code quality and consistency, we use some tools to run some checks on the code in the repo. These tools include:

- [ESLint](https://eslint.org/): JS and TS checks
- [Prettier](https://prettier.io/): code formatting
- [Markdownlint](https://github.com/DavidAnson/markdownlint): Markdown checks
- [Stylelint](https://stylelint.io/): CSS checks
- [lint-staged](https://github.com/lint-staged/lint-staged): run commands only on files that will be committed
- [Husky](https://typicode.github.io/husky/): git hooks

The repo is set up to run these checks automatically when committing changes with git hooks. You can [disable these git hooks](https://typicode.github.io/husky/how-to.html#skipping-git-hooks) by setting the environment variable `HUSKY=0`.

## Translations

We have a few localizable strings in the video editor, currently only English and German. If you'd like to improve these or add a language that you know, please add a new `.json` file and open a pull request!

## Testing

We use [Vitest](https://vitest.dev/) for testing. Test files are named `*.test.ts`. Run all tests in the repo with.

```sh
npm test
```
