const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Enable @/ path alias → src/
const srcDir = path.resolve(__dirname, "src");

// Force-resolve React-related packages to apps/mobile/node_modules so the
// monorepo root's React 18 (used by apps/web / Next.js) cannot be loaded
// alongside the React 19 that React Native 0.81 requires. Two copies of
// React in the same bundle break hooks ("useRef of null").
const localNodeModules = path.resolve(__dirname, "node_modules");
// Top-level packages only — sub-paths like ``react/jsx-runtime`` are covered
// by the parent package's ``exports`` map and must NOT be listed here
// (React 19 does not expose ``./jsx-runtime/package.json`` as a subpath).
const dedupedPackages = [
  "react",
  "react-dom",
  "react-native",
  "scheduler",
];

const dedupedAliases = {};
for (const name of dedupedPackages) {
  try {
    const pkgJsonPath = require.resolve(`${name}/package.json`, {
      paths: [localNodeModules],
    });
    dedupedAliases[name] = path.dirname(pkgJsonPath);
  } catch {
    // Package not installed locally — skip; Metro will fall back to its
    // default resolution. ``scheduler`` is hoisted to the workspace root
    // when its version matches across workspaces, which is fine because
    // scheduler is stateless.
  }
}

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("@/")) {
    const resolved = path.join(srcDir, moduleName.slice(2));
    return context.resolveRequest(context, resolved, platform);
  }
  // Pin react / react-dom / react-native (and any of their subpaths) to
  // the mobile workspace's copies so we never accidentally load the
  // root-level React 18 that exists for the Next.js web app.
  for (const pkgName of dedupedPackages) {
    if (
      moduleName === pkgName ||
      moduleName.startsWith(`${pkgName}/`)
    ) {
      try {
        return {
          type: "sourceFile",
          filePath: require.resolve(moduleName, {
            paths: [localNodeModules],
          }),
        };
      } catch {
        // Fall through to default resolver if subpath isn't directly
        // resolvable (e.g. virtual exports) — Metro will still pick the
        // local copy because of nodeModulesPaths ordering below.
        break;
      }
    }
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Tell Metro to also watch the mobile workspace's node_modules first.
config.resolver.nodeModulesPaths = [
  localNodeModules,
  ...(config.resolver.nodeModulesPaths || []),
];

// NOTE: We deliberately do NOT set `disableHierarchicalLookup = true` —
// some libraries (notably ``expo-router/entry-classic`` importing
// ``@expo/metro-runtime``) live in nested ``node_modules`` and rely on
// Node's standard upward traversal to be found. The forced subpath alias
// for react/react-dom/react-native in ``resolveRequest`` above is enough
// on its own to keep React 19 isolated from the workspace root's React 18.

module.exports = config;
