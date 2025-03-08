import Fastify, { type FastifyRequest } from "fastify";
import { createClient } from "redis";
import { generate } from "shortid";
import { cleanEnv, str, num } from "envalid";
import "dotenv/config";

function checkEnv() {
  // Validate environment variables
  return cleanEnv(process.env, {
    NODE_ENV: str({
      choices: ["development", "production"],
      default: "development",
    }),
    REDIS_URL: str(),
    REDIS_URL2: str(),
    REDIS_URL3: str(),
    PORT: num({ default: 3000 }),
    HOST: str({ default: "http://localhost" }),
  });
}

async function bootstrap() {
  const env = checkEnv();

  // Initialize Fastify
  const app = Fastify({ logger: true });
  const redisClients = [
    await createClient({ url: `redis://${env.REDIS_URL}` })
      .on("error", (err) => console.log("Redis Client Error", err))
      .connect(),
    await createClient({ url: `redis://${env.REDIS_URL2}` })
      .on("error", (err) => console.log("Redis2 Client Error", err))
      .connect(),
    await createClient({ url: `redis://${env.REDIS_URL3}` })
      .on("error", (err) => console.log("Redis3 Client Error", err))
      .connect(),
  ];

  // Hash function to distribute keys among Redis clients
  function getRedisClient(key: string) {
    const hash = key
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return redisClients[hash % redisClients.length];
  }

  // Endpoint to shorten a URL
  app.post(
    "/shorten",
    async (
      req: FastifyRequest<{ Body: { url: string; ttl?: number } }>,
      res
    ) => {
      const { url, ttl } = req.body; // ttl (time-to-live) is optional
      if (!url) return res.status(400).send("URL is required");

      const shortId = generate();
      const redisClient = getRedisClient(shortId);

      await redisClient.set(shortId, url, { EX: ttl || 3600 }); // Default TTL of 1 hour in seconds
      res.status(201).send({ shortUrl: `${env.HOST}:${env.PORT}/${shortId}` });
    }
  );

  // Endpoint to retrieve the original URL
  app.get(
    "/:shortId",
    async (req: FastifyRequest<{ Params: { shortId: string } }>, res) => {
      const { shortId } = req.params;
      const redisClient = getRedisClient(shortId);
      const url = await redisClient.get(shortId);
      if (!url) {
        app.log.info(`URL not found for shortId: ${shortId}`);
        return res.status(404).send("URL not found");
      }
      app.log.info(`Redirecting to URL: ${url}`);
      res.redirect(url);
    }
  );

  app.get("/", async (req, res) => {
    res.send("Hello World!");
  });

  try {
    await app.listen({ port: env.PORT });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();
