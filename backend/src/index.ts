import FireFly from "@hyperledger/firefly-sdk";
import bodyparser from "body-parser";
import { randomUUID } from "crypto";
import express, { Request, Response } from "express";
import movieRatings from "../../solidity/artifacts/contracts/MovieRatings.sol/MovieRatings.json";
import config from "../config.json";

const app = express();
const firefly = new FireFly({
  host: config.HOST,
  namespace: config.NAMESPACE,
});

const ffiName = `movieRatingsFFI-${config.VERSION}`;
const apiName = `movieRatingsApi-${config.VERSION}`;

// Named demo wallets (address per persona). Each wallet can rate a movie once.
const raters: Record<string, string> = config.RATERS;

app.use(bodyparser.json());

// ---------------------------------------------------------------------------
// Admin auth: only the admin account may add movies. The contract enforces
// this on-chain (msg.sender == admin); this login gates who can make the
// backend sign with the admin key.
// ---------------------------------------------------------------------------

const adminTokens = new Set<string>();

function isAdmin(req: Request): boolean {
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  return token !== undefined && adminTokens.has(token);
}

app.post("/api/login", (req, res) => {
  if (req.body.password === config.ADMIN_PASSWORD) {
    const token = randomUUID();
    adminTokens.add(token);
    res.send({ token });
  } else {
    res.status(401).send({ error: "Wrong password" });
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
  // An initial comment makes proxies (e.g. the Vite dev server) flush the
  // response headers through to the browser right away.
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

app.get("/api/raters", (req, res) => {
  res.send(
    Object.entries(raters).map(([name, address]) => ({ name, address }))
  );
});

function resolveRaterKey(rater: unknown): string {
  const key = raters[String(rater)];
  if (!key) {
    throw new Error(
      `Unknown rater '${rater}'. Expected one of: ${Object.keys(raters).join(
        ", "
      )}`
    );
  }
  return key;
}

app.get("/api/movies", async (req, res) => {
  try {
    const rater = req.query.rater ? String(req.query.rater) : undefined;
    const raterKey = rater ? raters[rater] : undefined;

    const countRes = await firefly.queryContractAPI(apiName, "getMovieCount", {
      input: {},
    });
    const count = Number((countRes as any).output);

    const movies = await Promise.all(
      Array.from({ length: count }, async (_, movieId) => {
        const movie: any = await firefly.queryContractAPI(apiName, "getMovie", {
          input: { movieId },
        });
        const ratingTotal = Number(movie.ratingTotal);
        const ratingCount = Number(movie.ratingCount);

        let myRating = 0;
        if (raterKey) {
          const ratingRes: any = await firefly.queryContractAPI(
            apiName,
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
  } catch (e: any) {
    res.status(500).send({ error: e.message });
  }
});

app.post("/api/movies", async (req, res) => {
  if (!isAdmin(req)) {
    res.status(401).send({ error: "Only the admin can add movies" });
    return;
  }
  try {
    const { title, year } = req.body;
    const fireflyRes = await firefly.invokeContractAPI(apiName, "addMovie", {
      input: {
        title,
        year: Number(year) || 0,
      },
      key: config.ADMIN_ADDRESS,
    });
    res.status(202).send({ id: fireflyRes.id });
  } catch (e: any) {
    res.status(500).send({ error: e.message });
  }
});

app.post("/api/movies/:movieId/ratings", async (req, res) => {
  try {
    const { stars, rater } = req.body;
    const fireflyRes = await firefly.invokeContractAPI(apiName, "rateMovie", {
      input: {
        movieId: Number(req.params.movieId),
        stars: Number(stars),
      },
      key: resolveRaterKey(rater),
    });
    res.status(202).send({ id: fireflyRes.id });
  } catch (e: any) {
    res.status(500).send({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// FireFly setup: register the contract interface, API, and event listeners
// ---------------------------------------------------------------------------

async function init() {
  await firefly
    .generateContractInterface({
      name: ffiName,
      namespace: config.NAMESPACE,
      version: "1.0",
      description: "Deployed MovieRatings contract",
      input: {
        abi: movieRatings.abi,
      },
    })
    .then(async (generatedFFI) => {
      if (!generatedFFI) return;
      return await firefly.createContractInterface(generatedFFI, {
        confirm: true,
      });
    })
    .then(async (contractInterface) => {
      if (!contractInterface) return;
      return await firefly.createContractAPI(
        {
          interface: {
            id: contractInterface.id,
          },
          location: {
            address: config.MOVIE_RATINGS_ADDRESS,
          },
          name: apiName,
        },
        { confirm: true }
      );
    })
    .catch((e) => {
      const err = JSON.parse(JSON.stringify(e.originalError));

      if (err.status === 409) {
        console.log(`'${ffiName}' already exists in FireFly. Ignoring.`);
      } else {
        throw e;
      }
    });

  for (const eventName of ["MovieAdded", "MovieRated"]) {
    await firefly
      .createContractAPIListener(apiName, eventName, {
        topic: eventName.toLowerCase(),
      })
      .catch((e) => {
        const err = JSON.parse(JSON.stringify(e.originalError));

        if (err.status === 409) {
          console.log(
            `'${eventName}' event listener already exists in FireFly. Ignoring.`
          );
        } else {
          console.log(
            `Error creating listener for '${eventName}' event: ${err.message}`
          );
        }
      });
  }

  firefly.listen(
    {
      filter: {
        events: "blockchain_event_received",
      },
    },
    async (socket, event) => {
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
