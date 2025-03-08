import Fastify from "fastify";

async function bootstrap() {
  const app = Fastify({ logger: true });
  try {
    await app.listen({ port: 3000 });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();
