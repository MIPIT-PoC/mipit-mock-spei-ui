/**
 * @file postcss.config.mjs
 * @description PostCSS configuration enabling the Tailwind CSS v4 plugin so utility classes are processed during the SPEI mock UI build.
 * @author Nicolás Calderón
 * @project MIPIT-PoC — Cross-border Instant Payments Middleware
 */
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
