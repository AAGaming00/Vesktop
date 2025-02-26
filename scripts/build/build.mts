/*
 * SPDX-License-Identifier: GPL-3.0
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2023 Vendicated and Vencord contributors
 */

import { BuildContext, BuildOptions, context } from "esbuild";
import { copyFile } from "fs/promises";

import vencordDep from "./vencordDep.mjs";

const isDev = process.argv.includes("--dev");

const CommonOpts: BuildOptions = {
    minify: !isDev,
    bundle: true,
    sourcemap: "linked",
    logLevel: "info"
};

const NodeCommonOpts: BuildOptions = {
    ...CommonOpts,
    format: "cjs",
    platform: "node",
    external: ["electron"],
    target: ["esnext"],
    define: {
        IS_DEV: JSON.stringify(isDev)
    }
};

const contexts = [] as BuildContext[];
async function createContext(options: BuildOptions) {
    contexts.push(await context(options));
}

await Promise.all([
    process.platform === "linux" &&
        copyFile(
            "./node_modules/@vencord/venmic/prebuilds/venmic-addon-linux-x64/node-napi-v7.node",
            "./static/dist/venmic.node"
        ).catch(() => console.warn("Failed to copy venmic. Building without venmic support")),
    createContext({
        ...NodeCommonOpts,
        entryPoints: ["src/main/index.ts"],
        outfile: "dist/js/main.js",
        footer: { js: "//# sourceURL=VCDMain" }
    }),
    createContext({
        ...NodeCommonOpts,
        entryPoints: ["src/preload/index.ts"],
        outfile: "dist/js/preload.js",
        footer: { js: "//# sourceURL=VCDPreload" }
    }),
    createContext({
        ...NodeCommonOpts,
        entryPoints: ["src/updater/preload.ts"],
        outfile: "dist/js/updaterPreload.js",
        footer: { js: "//# sourceURL=VCDUpdaterPreload" }
    }),
    createContext({
        ...CommonOpts,
        globalName: "Vesktop",
        entryPoints: ["src/renderer/index.ts"],
        outfile: "dist/js/renderer.js",
        format: "iife",
        inject: ["./scripts/build/injectReact.mjs"],
        jsxFactory: "VencordCreateElement",
        jsxFragment: "VencordFragment",
        // Work around https://github.com/evanw/esbuild/issues/2460
        tsconfig: "./scripts/build/tsconfig.esbuild.json",
        external: ["@vencord/types/*"],
        plugins: [vencordDep],
        footer: { js: "//# sourceURL=VCDRenderer" }
    })
]);

const watch = process.argv.includes("--watch");

if (watch) {
    await Promise.all(contexts.map(ctx => ctx.watch()));
} else {
    await Promise.all(
        contexts.map(async ctx => {
            await ctx.rebuild();
            await ctx.dispose();
        })
    );
}
