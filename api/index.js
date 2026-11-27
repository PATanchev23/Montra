// The Montra API as a Vercel Function. vercel.json sends every /api/* request
// here; the Fastify app itself is bundled by `npm run build -w @montra/api`.
export { default } from '../apps/api/dist/vercel.js';
