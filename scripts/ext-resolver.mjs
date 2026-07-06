// Node module-resolution hook: lets standalone scripts import app modules that
// use CRA-style extensionless relative imports (e.g. `from '../data/constants'`).
// Registered by scripts/simulate-schemas.mjs — not used by the app build.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (err?.code === 'ERR_MODULE_NOT_FOUND' && (specifier.startsWith('./') || specifier.startsWith('../'))) {
      return next(`${specifier}.js`, context);
    }
    throw err;
  }
}
