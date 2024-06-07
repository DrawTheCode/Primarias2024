import express, { Request, Response } from 'express';
import responseTime from 'response-time';
import { configDotenv } from 'dotenv';
import { zoneList } from '../config/zoneTypes';
import {
  checkNotCopyFiles,
  filterSchemasFile,
  getFileList,
} from '../subscribers/checkSchemas';
import {
  getResultOneFilter,
  getResultTwoFilter,
  getResultsSchema,
  getSearch,
  getSearchByType,
  getSearchByTypeAndID,
  getZoneInfo,
  getZoneInfoFilterByType,
} from '../subscribers/readSchemas';
import { election } from '../config/electionsTypes';
import { ambit } from '../config/ambitTypes';
import { createClient } from 'redis';

export const zoneDefinitions = express.Router();
export const listing = express.Router();
export const results = express.Router();
export const search = express.Router();

search.use(responseTime());

configDotenv();
const accessCORS =
  process.env.CORS !== undefined ? process.env.CORS.split(',') : null;
const REDIS_URL =
  process.env.REDIS_URL !== undefined ? process.env.REDIS_URL : null;

async function setRegisterRedis(key: string, data: string, expiry: number) {
  if (REDIS_URL) {
    try {
      const client = await createClient({ url: `redis://${REDIS_URL}` })
        .on('error', err => console.log('Redis Client Error', err))
        .connect();
      await client.set(key, data, { EX: expiry });
      await client.disconnect();
    } catch (error) {
      console.error('ERROR=>', error);
    }
  }
  return null;
}

async function getRegisterRedis(key: string): Promise<string | null> {
  if (REDIS_URL) {
    try {
      console.log('estamos aca');
      const client = await createClient({ url: `redis://${REDIS_URL}` })
        .on('error', err => console.log('Redis Client Error => ', err))
        .connect();
      const result = await client.get(key);
      await client.disconnect();
      return result;
    } catch (error) {
      console.error('ERROR=>', error);
    }
  }
  return null;
}

function corsDefinitions(req: Request, res: Response) {
  let origin = req.header('referer');
  if (typeof origin === 'string' && origin.match(/\/$/) !== null) {
    origin = origin.replace(/\/$/, '');
  }
  if (origin && accessCORS && accessCORS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE');
  }
}

async function getCachedDataOrFetch(
  key: string,
  fetchFunction: () => Promise<any>,
  resetCache: boolean,
  expiry = 3600,
): Promise<{ data: any; fromCache: boolean; ttl?: number }> {
  if (REDIS_URL) {
    if (!resetCache) {
      const cachedData = await getRegisterRedis(key);
      if (cachedData) {
        return { data: JSON.parse(cachedData), fromCache: true };
      }
    }

    const freshData = await fetchFunction();
    await setRegisterRedis(key, JSON.stringify(freshData), expiry);
    return { data: freshData, fromCache: false };
  } else {
    const freshData = await fetchFunction();
    return { data: freshData, fromCache: false };
  }
}

zoneDefinitions.get('/zones', async (req, res) => {
  corsDefinitions(req, res);
  const resetCache = req.query.resetCache === 'true';
  const { data, fromCache } = await getCachedDataOrFetch(
    'zones',
    async () => zoneList,
    resetCache,
  );
  res.send(JSON.stringify({ data, redis: fromCache }));
});

zoneDefinitions.get('/elec', async (req, res) => {
  corsDefinitions(req, res);
  const resetCache = req.query.resetCache === 'true';
  const { data, fromCache } = await getCachedDataOrFetch(
    'elections',
    async () => election,
    resetCache,
  );
  res.send(JSON.stringify({ data, redis: fromCache }));
});

zoneDefinitions.get('/ambit', async (req, res) => {
  corsDefinitions(req, res);
  const resetCache = req.query.resetCache === 'true';
  const { data, fromCache } = await getCachedDataOrFetch(
    'ambit',
    async () => ambit,
    resetCache,
  );
  res.send(JSON.stringify({ data, redis: fromCache }));
});

listing.get('/files', async (req, res) => {
  const ftpPath = process.env.FTP_PATH;
  if (ftpPath) {
    corsDefinitions(req, res);
    const resetCache = req.query.resetCache === 'true';
    const { data, fromCache } = await getCachedDataOrFetch(
      'files',
      async () => await getFileList(ftpPath),
      resetCache,
    );
    res.send({ data, redis: fromCache });
  } else {
    res.status(400).send({ error: 'No hay ruta setteada en el sistema.' });
  }
});

listing.get('/not-copy', async (req, res) => {
  corsDefinitions(req, res);
  const resetCache = req.query.resetCache === 'true';
  const { data, fromCache } = await getCachedDataOrFetch(
    'not-copy',
    async () => await checkNotCopyFiles(),
    resetCache,
  );
  res.send({ data, redis: fromCache });
});

listing.get('/scenery/:zone', async (req, res) => {
  corsDefinitions(req, res);
  const resetCache = req.query.resetCache === 'true';
  const { data, fromCache } = await getCachedDataOrFetch(
    `scenery-${req.params.zone}`,
    async () => await filterSchemasFile(req.params.zone),
    resetCache,
  );
  res.send({ data, redis: fromCache });
});

listing.get('/data/:zone', async (req, res) => {
  corsDefinitions(req, res);
  const resetCache = req.query.resetCache === 'true';
  const { data, fromCache } = await getCachedDataOrFetch(
    `data-${req.params.zone}`,
    async () => await getZoneInfo(req.params.zone),
    resetCache,
  );
  res.send({ data, redis: fromCache });
});

listing.get('/data/:zone/filter/:type', async (req, res) => {
  corsDefinitions(req, res);
  const resetCache = req.query.resetCache === 'true';
  const { data, fromCache } = await getCachedDataOrFetch(
    `data-${req.params.zone}-${req.params.type}`,
    async () => await getZoneInfoFilterByType(req.params.zone, req.params.type),
    resetCache,
  );
  res.send({ data, redis: fromCache });
});

results.get('/all', async (req, res) => {
  corsDefinitions(req, res);
  const resetCache = req.query.resetCache === 'true';
  const { data, fromCache } = await getCachedDataOrFetch(
    'results-all',
    async () => await getResultsSchema(),
    resetCache,
  );
  res.send({ data, redis: fromCache });
});

results.get('/filter/:key/:value', async (req, res) => {
  corsDefinitions(req, res);
  const resetCache = req.query.resetCache === 'true';
  const { data, fromCache } = await getCachedDataOrFetch(
    `results-${req.params.key}-${req.params.value}`,
    async () => await getResultOneFilter(req.params.key, req.params.value),
    resetCache,
  );
  res.send({ data, redis: fromCache });
});

results.get(
  '/filter/:firstKey/:firstValue/:secondKey/:secondValue',
  async (req, res) => {
    corsDefinitions(req, res);
    const resetCache = req.query.resetCache === 'true';
    const { data, fromCache } = await getCachedDataOrFetch(
      `results-${req.params.firstKey}-${req.params.firstValue}-${req.params.secondKey}-${req.params.secondValue}`,
      async () =>
        await getResultTwoFilter(
          req.params.firstKey,
          req.params.firstValue,
          req.params.secondKey,
          req.params.secondValue,
        ),
      resetCache,
    );
    res.send({ data, redis: fromCache });
  },
);

search.get('/by/:complexId', async (req, res) => {
  corsDefinitions(req, res);
  const resetCache = req.query.resetCache === 'true';
  const { data, fromCache } = await getCachedDataOrFetch(
    `search-${req.params.complexId}`,
    async () => await getSearch(req.params.complexId),
    resetCache,
  );
  res.send({ data, redis: fromCache });
});

search.get('/by/type/:typeZone', async (req, res) => {
  corsDefinitions(req, res);
  const resetCache = req.query.resetCache === 'true';
  const { data, fromCache } = await getCachedDataOrFetch(
    `search-type-${req.params.typeZone}`,
    async () => await getSearchByType(req.params.typeZone),
    resetCache,
  );
  res.send({ data, redis: fromCache });
});

search.get('/by/type/:typeZone/:idZone', async (req, res) => {
  corsDefinitions(req, res);
  const resetCache = req.query.resetCache === 'true';
  const { data, fromCache } = await getCachedDataOrFetch(
    `search-type-${req.params.typeZone}-${req.params.idZone}`,
    async () =>
      await getSearchByTypeAndID(req.params.typeZone, req.params.idZone),
    resetCache,
  );
  res.send({ data, redis: fromCache });
});
