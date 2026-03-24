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

The site serves its runtime assets from `public/`, including the compressed datasets, sounds, spectrograms, and image assets required by the globe and UMAP views.
