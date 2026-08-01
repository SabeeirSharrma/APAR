import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: true,
  splitting: false,
  bundle: true,
  external: [
    'better-sqlite3',
    'express',
    'cors',
    'helmet',
    'multer',
    'openai',
    'zod',
    'jsonwebtoken',
    'bcryptjs',
    'express-rate-limit',
    'dotenv',
  ],
});
