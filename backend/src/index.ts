import FireFly from "@hyperledger/firefly-sdk";
import bodyparser from "body-parser";
import express, { Request, Response } from "express";
import {
  bearerToken,
  createAdminSession,
  createRaterSession,
  getSession,
  isAdmin,
  isRater,
} from "./auth";
import { config, raterPassword } from "./config";
import { apiName, registerContract, validateConfig } from "./firefly-setup";

const app = express();
const firefly = new FireFly({
  host: config.HOST,
  namespace: config.NAMESPACE,
});

const contractApi = apiName();
const raters: Record<string, string> = config.RATERS;

app.use(bodyparser.json());

// ---------------------------------------------------------------------------
// Auth: admin and rater sessions gate who the backend signs for.
// ---------------------------------------------------------------------------

app.post("/api/login", (req, res) => {
  if (req.body.password === config.ADMIN_PASSWORD) {
    const token = createAdminSession(config.ADMIN_ADDRESS);
    res.send({ token });
  } else {
    res.status(401).send({ error: "Wrong password" });
  }
});

app.post("/api/rater/login", (req, res) => {
  const rater = String(req.body.rater ?? "");
  const password = String(req.body.password ?? "");
  const address = raters[rater];

  if (!address) {
    res.status(400).send({
      error: `Unknown rater '${rater}'. Expected one of: ${Object.keys(raters).join(", ")}`,
    });
    return;
  }

  if (password !== raterPassword(rater)) {
    res.status(401).send({ error: "Wrong password" });
    return;
  }

  const token = createRaterSession(rater, address);
  res.send({ token, rater, address });
});

// ---------------------------------------------------------------------------
// Health and operation status
// ---------------------------------------------------------------------------

app.get("/api/health", async (_req, res) => {
  const issues = validateConfig();
  let fireflyReachable = false;

  try {
    const statusRes = await fetch(`${config.HOST}/api/v1/status`);
    fireflyReachable = statusRes.ok;
    if (!statusRes.ok) {
      issues.push("FireFly status check failed");
    }
  } catch {
    issues.push(`FireFly unreachable at ${config.HOST}`);
  }

  const ok = issues.length === 0 && fireflyReachable;
  res.status(ok ? 200 : 503).send({
    status: ok ? "ok" : "degraded",
    firefly: {
      host: config.HOST,
      namespace: config.NAMESPACE,
      reachable: fireflyReachable,
    },
    contract: config.MOVIE_RATINGS_ADDRESS || null,
    raters: Object.keys(raters),
    issues,
  });
});

app.get("/api/operations/:id", async (req, res) => {
  try {
    const url = `${config.HOST}/api/v1/namespaces/${config.NAMESPACE}/operations/${req.params.id}`;
    const ffRes = await fetch(url);
    const body = await ffRes.json();
    res.status(ffRes.status).send(body);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    res.status(502).send({ error: message });
  }
});

// ---------------------------------------------------------------------------
// Server-Sent Events: pushes confirmed blockchain events to the frontend
// ---------------------------------------------------------------------------

const sseClients = new Set<Response>();

app.get("/api/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();
  res.write(": connected\n\n");
  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

/* eslint-disable  @typescript-eslint/no-explicit-any */
function broadcast(name: string, data: any) {
  const payload = `data: ${JSON.stringify({ name, data })}\n\n`;
  sseClients.forEach((client) => client.write(payload));
}

// ---------------------------------------------------------------------------
// REST API
// ---------------------------------------------------------------------------

app.get("/api/raters", (_req, res) => {
  res.send(
    Object.entries(raters).map(([name, address]) => ({ name, address }))
  );
});

app.get("/api/movies", async (req, res) => {
  try {
    const rater = req.query.rater ? String(req.query.rater) : undefined;
    const raterKey = rater ? raters[rater] : undefined;

    const countRes = await firefly.queryContractAPI(contractApi, "getMovieCount", {
      input: {},
    });
    const count = Number((countRes as any).output);

    const movies = await Promise.all(
      Array.from({ length: count }, async (_, movieId) => {
        const movie: any = await firefly.queryContractAPI(contractApi, "getMovie", {
          input: { movieId },
        });
        const ratingTotal = Number(movie.ratingTotal);
        const ratingCount = Number(movie.ratingCount);

        let myRating = 0;
        if (raterKey) {
          const ratingRes: any = await firefly.queryContractAPI(
            contractApi,
            "getRating",
            { input: { movieId, rater: raterKey } }
          );
          myRating = Number(ratingRes.stars);
        }

        return {
          id: movieId,
          title: movie.title,
          year: Number(movie.year),
          addedBy: movie.addedBy,
          ratingCount,
          average: ratingCount > 0 ? ratingTotal / ratingCount : 0,
          myRating,
        };
      })
    );

    res.send(movies);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    res.status(500).send({ error: message });
  }
});

app.post("/api/movies", async (req, res) => {
  const session = getSession(bearerToken(req));
  if (!isAdmin(session)) {
    res.status(401).send({ error: "Only the admin can add movies" });
    return;
  }

  try {
    const { title, year } = req.body;
    const fireflyRes = await firefly.invokeContractAPI(contractApi, "addMovie", {
      input: {
        title,
        year: Number(year) || 0,
      },
      key: config.ADMIN_ADDRESS,
    });
    res.status(202).send({ id: fireflyRes.id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    res.status(500).send({ error: message });
  }
});

app.post("/api/movies/:movieId/ratings", async (req, res) => {
  const session = getSession(bearerToken(req));
  if (!isRater(session) || !session?.address) {
    res.status(401).send({ error: "Sign in as a rater to submit ratings" });
    return;
  }

  try {
    const { stars } = req.body;
    const fireflyRes = await firefly.invokeContractAPI(contractApi, "rateMovie", {
      input: {
        movieId: Number(req.params.movieId),
        stars: Number(stars),
      },
      key: session.address,
    });
    res.status(202).send({ id: fireflyRes.id, rater: session.rater });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    res.status(500).send({ error: message });
  }
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function init() {
  const configIssues = validateConfig();
  if (configIssues.length > 0) {
    console.warn("Configuration issues detected:");
    configIssues.forEach((issue) => console.warn(`  - ${issue}`));
    console.warn("Run: node scripts/bootstrap.mjs");
  }

  await registerContract(firefly);

  firefly.listen(
    {
      filter: {
        events: "blockchain_event_received",
      },
    },
    async (_socket, event) => {
      const name = event.blockchainEvent?.name;
      if (name === "MovieAdded" || name === "MovieRated") {
        console.log(`${name}: ${JSON.stringify(event.blockchainEvent?.output)}`);
        broadcast(name, event.blockchainEvent?.output);
      }
    }
  );

  app.listen(config.PORT, () =>
    console.log(`Movie ratings DApp backend listening on port ${config.PORT}!`)
  );
}

init().catch((err) => {
  console.error(err.stack);
  process.exit(1);
});

module.exports = {
  app,
};
