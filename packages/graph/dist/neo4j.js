"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDriver = getDriver;
exports.getReadSession = getReadSession;
exports.getWriteSession = getWriteSession;
exports.verifyConnectivity = verifyConnectivity;
exports.closeDriver = closeDriver;
const neo4j_driver_1 = __importDefault(require("neo4j-driver"));
function getConfig() {
    return {
        uri: process.env.NEO4J_URI ?? 'bolt://localhost:7687',
        user: process.env.NEO4J_USER ?? 'neo4j',
        password: process.env.NEO4J_PASSWORD ?? 'neo4j',
        database: process.env.NEO4J_DATABASE ?? 'neo4j',
        maxConnectionPoolSize: 50,
    };
}
// ─── Singleton Driver ─────────────────────────────────────────────────────────
let _driver = null;
/**
 * Returns the singleton Neo4j driver, creating it on first call.
 */
function getDriver() {
    if (!_driver) {
        const config = getConfig();
        _driver = neo4j_driver_1.default.driver(config.uri, neo4j_driver_1.default.auth.basic(config.user, config.password), {
            maxConnectionPoolSize: config.maxConnectionPoolSize,
            connectionAcquisitionTimeout: 30_000,
            maxTransactionRetryTime: 15_000,
            logging: neo4j_driver_1.default.logging.console('warn'),
        });
    }
    return _driver;
}
// ─── Session Helpers ──────────────────────────────────────────────────────────
/**
 * Opens a read session against the configured database.
 */
function getReadSession() {
    const config = getConfig();
    return getDriver().session({
        database: config.database,
        defaultAccessMode: neo4j_driver_1.default.session.READ,
    });
}
/**
 * Opens a write session against the configured database.
 */
function getWriteSession() {
    const config = getConfig();
    return getDriver().session({
        database: config.database,
        defaultAccessMode: neo4j_driver_1.default.session.WRITE,
    });
}
// ─── Health Check ─────────────────────────────────────────────────────────────
/**
 * Verifies connectivity to Neo4j. Resolves true on success, throws on failure.
 */
async function verifyConnectivity() {
    await getDriver().verifyConnectivity();
    return true;
}
// ─── Graceful Shutdown ────────────────────────────────────────────────────────
/**
 * Closes the driver and releases all pooled connections.
 */
async function closeDriver() {
    if (_driver) {
        await _driver.close();
        _driver = null;
    }
}
//# sourceMappingURL=neo4j.js.map