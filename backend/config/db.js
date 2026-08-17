const mongoose = require('mongoose');
const dns = require('dns');

// The system DNS may be a local proxy (127.0.0.1 from VPN / ad-blocker /
// corporate DNS tools) that refuses SRV queries. This breaks
// mongodb+srv:// connection strings because the MongoDB Node.js driver
// uses dns.resolveSrv() (c-ares) for SRV record lookups.
// Override with public resolvers when a local proxy is detected.
// dns.lookup() (getaddrinfo) still uses the system resolver, so local
// hostname resolution is unaffected.
const _systemDns = dns.getServers();
if (_systemDns.includes('127.0.0.1')) {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    console.log('🔧 System DNS is a local proxy — using public resolvers (8.8.8.8, 1.1.1.1) for SRV lookups.');
}

let isConnected = false;
let isConnecting = false;
let reconnectInterval = null;

const connectDB = async () => {
    // Guard against concurrent connect() calls racing on the shared
    // isConnected flag (e.g. if connectWithRetry() is invoked more than
    // once). Without this, a second in-flight connect can overwrite the
    // success state set by the first, causing false "degraded mode".
    if (isConnecting) return isConnected;
    isConnecting = true;
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        isConnected = true;
        console.log('✅ MongoDB connected successfully');
        if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
        }
    } catch (error) {
        isConnected = false;
        console.warn('⚠️  MongoDB unavailable — running in degraded mode.');
        console.error('   Reason:', error.message);
    } finally {
        isConnecting = false;
    }
};

const isDBConnected = () => isConnected;

const connectWithRetry = async () => {
    for (let attempt = 1; attempt <= 3; attempt++) {
        await connectDB();
        if (isConnected) return;
        if (attempt < 3) {
            console.warn('Retry attempt ' + attempt + '/3 — reconnecting in 5s...');
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }
    // Start periodic background reconnection if all initial attempts fail
    if (!isConnected && !reconnectInterval) {
        console.log('🔄 Starting periodic DB reconnection (every 30s)...');
        reconnectInterval = setInterval(connectDB, 30000);
        if (reconnectInterval.unref) reconnectInterval.unref();
    }
};

module.exports = { connectDB, isDBConnected, connectWithRetry };