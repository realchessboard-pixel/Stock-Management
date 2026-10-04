import "dotenv/config";

// Point every server module at the disposable test database.
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL must be set to run tests");
process.env.DATABASE_URL = testUrl;
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-123456";
Object.assign(process.env, { NODE_ENV: "test" });
