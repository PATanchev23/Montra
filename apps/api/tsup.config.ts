import { defineConfig } from 'tsup';

export default defineConfig({
  // server.ts listens on a port (npm start); vercel.ts is the same app as a Vercel Function.
  entry: ['src/server.ts', 'src/vercel.ts'],
  format: 'esm',
  target: 'node22',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // Workspace packages ship TypeScript source, so bundle them into the output.
  noExternal: ['@montra/shared'],
});
