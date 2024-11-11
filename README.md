<picture>
  <source srcset="./src/assets/branding/logo/white-logo.svg" media="(prefers-color-scheme: dark)" height="170px" width="100%">
  <img src="./src/assets/branding/logo/dark-logo.svg" height="170px" width="100%">
</picture>

Miru is a new set of modular, extensible Web platform tools and components for still image and multi-track video editing and state-of-the-art, real-time AR. Using WebGL, WebAssembly, and open source, mobile-optimized machine learning models, Miru will give people on the social web the tools to edit images and apply interactive effects to recorded video without compromising on privacy and transparency. Miru aims to provide intuitive and user-friendly UIs which developers can easily integrate into their Web apps regardless of the frontend frameworks they use.

You can try out the image editing features at https://demo.miru.media

## Roadmap

This project is still in its early stages. We're working on:

- [x] Still iamge editor with WebGL filters
- [ ] Mobile-friendly video editor
- [ ] WebGL video effects
- [ ] Documentation
- [ ] Real-time AR effects using [MediaPipe](https://github.com/google-ai-edge/mediapipe)

## Development Setup

This repo uses the [`pnpm`](https://pnpm.io/) package manager. It can be installed with regular `npm`

```sh
npm install --global pnpm
```

Then use `pnpm` to install the project's dependencies and start the vite development server.

```sh
pnpm install
pnpm run dev
```

## Funding

This project is funded through [NGI Zero Core](https://nlnet.nl/core), a fund established by [NLnet](https://nlnet.nl) with financial support from the European Commission's [Next Generation Internet](https://ngi.eu) program. Learn more at the [NLnet project page](https://nlnet.nl/project/Miru).

[<img src="https://nlnet.nl/logo/banner.png" alt="NLnet foundation logo" width="20%" />](https://nlnet.nl)
[<img src="https://nlnet.nl/image/logos/NGI0_tag.svg" alt="NGI Zero Logo" width="20%" />](https://nlnet.nl/core)
