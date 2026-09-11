# Blog

Source for my blog at https://robin.tarxz.zip/blog/

## Local Development

```bash
# Clone the blog repo
git clone git@github.com:HuntedRaven7/blog.git
cd blog

# Clone the content repo into the content/ directory
git clone git@github.com:HuntedRaven7/content.git content

# Install dependencies
npm ci

# Start dev server
npm run dev
```

## Content

Content is stored in a separate repository: https://github.com/HuntedRaven7/content

The `content/` directory is gitignored and populated during CI via the deploy workflow.

## Deployment

Push to `main` triggers GitHub Pages deployment via `.github/workflows/deploy.yml`.

## Tech

- Astro
- D3.js force-directed graph
- Remote content from `https://github.com/HuntedRaven7/content`

