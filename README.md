# Colour tools

Small static tools for working with colours. Live site: [filcuk.github.io/colour-tools](https://filcuk.github.io/colour-tools/)

## Opacity match

When you need to use transparency **and** match a particular solid colour on a background, opacity match calculates the nearest opaque target colour or layer opacity.

1. Set **base colour** — the blended result you want to match.
2. Set **background colour** — the surface behind the semi-transparent layer.
3. Either set **opacity** and click **Calculate Target**, or set **target colour** and click **Calculate Opacity**.

The tool uses per-channel sRGB blending (`foreground × α + background × (1 − α)`). Opacity is the alpha byte (0–255) in `#RRGGBBAA`; only 8-bit channel rounding limits exact matches.

Results include a blended preview, output colour (`#RRGGBBAA` when target and opacity are set), match percentage, and a channel comparison chart.

## Development

Built on the [SMA1 Framework](https://github.com/filcuk/sma1-framework) — plain HTML, CSS, and ES modules, deployed to GitHub Pages.

```bash
npm ci
npm run lint
npm test
npm run verify:framework
npx serve .
```

`npm test` runs the fork test suite (`scripts/test-app.mjs`) — catalogue tests for trimmed framework components are skipped.  
App logic lives under `app/tools/`. Colour math: `app/utils/blend.js` (fork-local, outside `framework-manifest.json`) and `app/tools/opacity-match-calc.js`.

## License

MIT — see [LICENSE](LICENSE).
