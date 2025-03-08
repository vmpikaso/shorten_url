import Fastify, { type FastifyRequest } from "fastify";
import { createClient } from "redis";
import { generate } from "shortid";

async function bootstrap() {
  const app = Fastify({ logger: true });
  const redisClients = [
    await createClient({ url: "redis://localhost:6379" })
      .on("error", (err) => console.log("Redis Client Error", err))
      .connect(),
    await createClient({ url: "redis://localhost:6380" })
      .on("error", (err) => console.log("Redis2 Client Error", err))
      .connect(),
    await createClient({ url: "redis://localhost:6381" })
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
    async (req: FastifyRequest<{ Body: { url: string } }>, res) => {
      const { url } = req.body;
      if (!url) return res.status(400).send("URL is required");

      const shortId = generate();
      const redisClient = getRedisClient(shortId);

      await redisClient.set(shortId, url);
      res.status(201).send({ shortUrl: `http://localhost:3000/${shortId}` });
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
        return res.status(404).send("URL not found");
      }
      res.redirect(url);
    }
  );

  app.get("/", async (req, res) => {
    res.send("Hello World!");
  });

  try {
    await app.listen({ port: 3000 });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();
