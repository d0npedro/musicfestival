import { defineConfig, loadEnv } from 'vite';
import { resolveBaseFromEnv } from './src/deploy/basePath.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = resolveBaseFromEnv({
    VITE_BASE: env.VITE_BASE ?? process.env.VITE_BASE,
    BASE_PATH: env.BASE_PATH ?? process.env.BASE_PATH,
  });

  return {
    base,
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
