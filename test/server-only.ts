// `server-only` throws when imported outside Next's server bundle, which is
// every vitest run. The guard still applies in the app — this stub only lets
// a server module's pure logic be tested.
export {};
