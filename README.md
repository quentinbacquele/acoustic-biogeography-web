# Acoustic Biogeography Web

Static Vite site for the `acoustic-biogeography` Vercel project.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The build output is generated in `dist/`.

## Deploy on Vercel

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

## Data layout

The site serves only the runtime assets in `public/`:

- `public/data/geographic_model_data_with_biomes.csv`
- `public/data/ultra_optimized/`
- `public/images/`
- `public/sounds/`
- `public/spectrograms/`

Source and archival datasets are stored in `data_sources/` so they stay in the repository without being deployed as public assets.
