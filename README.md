# Quick QR code generator

A small browser-based QR code generator. Type or paste text and it renders a QR
code as SVG or bitmap directly in the browser, with support for choosing error
correction level, version range, and mask. Text can also be entered directly via
the URL by appending at the end starting with `#`.

Available at https://knutas.github.io/qqr/

## Build

The app is written in TypeScript under [src](src) and compiled to [dist](dist)
using `tsc`.

`dist/index.html` and `dist/style.css` are static assets served alongside the
compiled JS.

## License

This project is licensed under the
[GNU Affero General Public License v3.0](LICENSE).

It bundles [`qrcodegen.ts`](src/qrcodegen.ts), the
[QR Code generator library by
Project Nayuki](https://www.nayuki.io/page/qr-code-generator-library), which is
separately licensed under the MIT License.
