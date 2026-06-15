import { defineConfig } from 'vitest/config'

// Unit-tests voor de pure logica (i18n, mail, log, signal). De 3D-scene en
// React-componenten testen we bewust niet — die leveren in CI vooral flaky
// runs op. jsdom geeft window/localStorage/navigator voor de i18n-tests;
// het server-bestand draait per-file in een node-omgeving (zie docblock).
export default defineConfig({
  test: {
    environment: 'jsdom',
    // niet-opaque origin, anders is localStorage uitgeschakeld (i18n-test)
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    include: ['src/**/*.test.ts', 'server/**/*.test.js'],
    restoreMocks: true,
    unstubGlobals: true,
  },
})
