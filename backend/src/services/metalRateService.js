const axios = require("axios");
const cron = require("node-cron");
const Decimal = require("decimal.js");
const { pool } = require("../config/db");

const GOLD_API_BASE_URL = "https://www.goldapi.io/api/price";
const TROY_OUNCE_GRAMS = new Decimal("31.1034768");
const METALS = [
  { metalType: "GOLD", symbol: "XAU", basePurity: "24K" },
  { metalType: "SILVER", symbol: "XAG", basePurity: "999" },
  { metalType: "PLATINUM", symbol: "XPT", basePurity: "999" },
];

let schedulerTask;
let nextScheduledFetchAt = null;
let refreshInFlight;

const getFetchIntervalMs = () => {
  const configured = Number(process.env.GOLD_RATE_FETCH_INTERVAL_MINUTES || 1440);
  const minutes = Number.isFinite(configured) && configured >= 1 && configured <= 43200
    ? configured
    : 1440;
  return minutes * 60 * 1000;
};

const getAllMetalRates = async () => {
  const result = await pool.query(`
    SELECT id, metal_type, purity, rate_per_gram, currency, source, updated_at
    FROM metal_rates
    ORDER BY metal_type, purity
  `);
  return result.rows;
};

const getMetalRateHistory = async (limit = 50) => {
  const parsedLimit = Number.parseInt(limit, 10);
  const safeLimit = Number.isInteger(parsedLimit)
    ? Math.max(1, Math.min(parsedLimit, 500))
    : 50;
  const result = await pool.query(`
    SELECT id, metal_type, purity, rate_per_gram, currency, source,
           provider_spot_price, provider_timestamp, recorded_at
    FROM metal_rate_history
    ORDER BY recorded_at DESC, id DESC
    LIMIT $1
  `, [safeLimit]);
  return result.rows;
};

const parseProviderTimestamp = (value) => {
  const timestamp = typeof value === "number" || /^\d+$/.test(String(value))
    ? new Date(Number(value) * 1000)
    : new Date(value);
  if (!Number.isFinite(timestamp.getTime())) {
    throw new Error("GoldAPI response has an invalid timestamp");
  }
  return timestamp;
};

const validateProviderResponse = (data, metal) => {
  if (!data || typeof data !== "object") {
    throw new Error(`GoldAPI returned an empty ${metal.metalType} response`);
  }
  if (data.metal !== metal.symbol || data.currency !== "INR") {
    throw new Error(`GoldAPI returned unexpected metal or currency for ${metal.metalType}`);
  }
  // GoldAPI's price field is denominated in troy ounces. Reject an explicitly
  // different unit instead of silently applying the wrong conversion.
  if (data.unit && data.unit !== "troy_ounce") {
    throw new Error(`GoldAPI returned an unsupported unit for ${metal.metalType}`);
  }
  const parsePositivePrice = (value) => {
    if (value == null) return null;
    try {
      const parsed = new Decimal(value);
      return parsed.isFinite() && parsed.isPositive() ? parsed : null;
    } catch {
      return null;
    }
  };
  const basePerGram = parsePositivePrice(data.price_per_unit?.gram)
    || parsePositivePrice(data.price_gram_24k);
  const spotPrice = parsePositivePrice(data.price)
    || (basePerGram ? basePerGram.mul(TROY_OUNCE_GRAMS) : null);
  const goldPurityRates = new Map();
  if (metal.metalType === "GOLD") {
    for (const karat of [24, 22, 21, 20, 18, 16, 14, 10]) {
      const price = parsePositivePrice(data[`price_gram_${karat}k`]);
      if (price) goldPurityRates.set(`${karat}K`, price);
    }
  }
  if (!spotPrice && !basePerGram) {
    throw new Error(`GoldAPI returned an invalid ${metal.metalType} price`);
  }
  return {
    spotPrice,
    basePerGram,
    goldPurityRates,
    providerTimestamp: parseProviderTimestamp(data.timestamp),
  };
};

// Supports conventional karat labels (18K, 22KT) and fineness labels (925,
// 950, 999). Unknown labels fail the refresh before any database writes.
const purityFactor = (purity) => {
  const match = String(purity).trim().match(/^(\d+(?:\.\d+)?)\s*(K|KT|KARAT|KARATS)?$/i);
  if (!match) throw new Error(`Unsupported configured metal purity: ${purity}`);
  const value = new Decimal(match[1]);
  const suffix = (match[2] || "").toUpperCase();
  if (suffix || value.lte(24)) {
    if (!value.isPositive() || value.gt(24)) {
      throw new Error(`Unsupported configured metal purity: ${purity}`);
    }
    return value.div(24);
  }
  if (value.gt(1000)) throw new Error(`Unsupported configured metal purity: ${purity}`);
  return value.div(1000);
};

const fetchAllProviderRates = async (apiKey) => {
  const responses = await Promise.all(METALS.map((metal) => axios.get(
    `${GOLD_API_BASE_URL}/${metal.symbol}/INR`,
    {
      headers: { "x-access-token": apiKey, "Content-Type": "application/json" },
      timeout: 15000,
    }
  )));

  return METALS.map((metal, index) => ({
    ...metal,
    ...validateProviderResponse(responses[index].data, metal),
  }));
};

const persistProviderRates = async (providerRates) => {
  // Refresh all configured product purities and a pure-metal reference row.
  // Resolve every purity before opening the write transaction so an unknown
  // label cannot leave only part of the metals updated.
  const purityResult = await pool.query(`
    SELECT metal_type, purity FROM metal_rates
    UNION
    SELECT p.metal_type, pv.purity
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    WHERE p.is_active = TRUE AND pv.is_active = TRUE
  `);
  const puritiesByMetal = new Map(METALS.map((metal) => [metal.metalType, new Set([metal.basePurity])]));
  for (const row of purityResult.rows) puritiesByMetal.get(row.metal_type)?.add(row.purity);

  const updates = [];
  for (const providerRate of providerRates) {
    const spotPerGram = providerRate.basePerGram
      || providerRate.spotPrice.div(TROY_OUNCE_GRAMS);
    for (const purity of puritiesByMetal.get(providerRate.metalType) || []) {
      const purityLabel = String(purity).trim().toUpperCase().replace(/\s+/g, "");
      const karatMatch = purityLabel.match(/^(\d+(?:\.\d+)?)(?:K|KT|KARAT|KARATS)?$/);
      const purityKey = karatMatch && new Decimal(karatMatch[1]).lte(24)
        ? `${karatMatch[1]}K`
        : purityLabel;
      const providerPurityRate = providerRate.goldPurityRates?.get(purityKey);
      const ratePerGram = (providerPurityRate || spotPerGram.mul(purityFactor(purity)))
        .toDecimalPlaces(4);
      if (!ratePerGram.isFinite() || !ratePerGram.isPositive()) {
        throw new Error(`Calculated ${providerRate.metalType} ${purity} rate is invalid`);
      }
      updates.push({
        metalType: providerRate.metalType,
        purity,
        ratePerGram: ratePerGram.toFixed(4),
        spotPrice: providerRate.spotPrice.toFixed(4),
        providerTimestamp: providerRate.providerTimestamp,
      });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const update of updates) {
      await client.query(`
        INSERT INTO metal_rates (metal_type, purity, rate_per_gram, currency, source, updated_at)
        VALUES ($1, $2, $3, 'INR', 'GOLDAPI', NOW())
        ON CONFLICT (metal_type, purity) DO UPDATE
        SET rate_per_gram = EXCLUDED.rate_per_gram,
            currency = EXCLUDED.currency,
            source = EXCLUDED.source,
            updated_at = NOW()
      `, [update.metalType, update.purity, update.ratePerGram]);

      await client.query(`
        INSERT INTO metal_rate_history (
          metal_type, purity, rate_per_gram, currency, source,
          provider_spot_price, provider_timestamp
        ) VALUES ($1, $2, $3, 'INR', 'GOLDAPI', $4, $5)
      `, [update.metalType, update.purity, update.ratePerGram,
        update.spotPrice, update.providerTimestamp]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const refreshMetalRatesFromGoldApi = async () => {
  if (refreshInFlight) return refreshInFlight;
  const apiKey = process.env.GOLD_API_KEY?.trim();
  if (!apiKey) {
    const error = new Error("GoldAPI is not configured on the server");
    error.statusCode = 503;
    throw error;
  }

  refreshInFlight = (async () => {
    // Promise.all fetches all metals before any rates/history are persisted.
    const providerRates = await fetchAllProviderRates(apiKey);
    await persistProviderRates(providerRates);
    return {
      updatedAt: new Date().toISOString(),
      rates: await getAllMetalRates(),
    };
  })();
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
};

const startMetalRateScheduler = () => {
  if (schedulerTask) return;
  if (!process.env.GOLD_API_KEY?.trim()) {
    console.warn("GoldAPI scheduler is disabled because GOLD_API_KEY is not configured");
    return;
  }

  const intervalMs = getFetchIntervalMs();
  const runIfDue = async () => {
    if (refreshInFlight) return;
    if (nextScheduledFetchAt == null) {
      try {
        const result = await pool.query(`
          SELECT MAX(recorded_at) AS last_success
          FROM metal_rate_history WHERE source = 'GOLDAPI'
        `);
        const lastSuccess = result.rows[0]?.last_success;
        nextScheduledFetchAt = lastSuccess
          ? new Date(lastSuccess).getTime() + intervalMs
          : 0;
      } catch (error) {
        nextScheduledFetchAt = Date.now() + intervalMs;
        console.error("Could not inspect last GoldAPI sync; keeping current rates", error.message);
        return;
      }
    }
    if (Date.now() < nextScheduledFetchAt) return;

    // Set the next time before fetching so provider failures do not cause a
    // request every minute. The current database rates remain untouched.
    nextScheduledFetchAt = Date.now() + intervalMs;
    try {
      const result = await refreshMetalRatesFromGoldApi();
      console.info(`GoldAPI updated ${result.rates.length} metal/purity rates`);
    } catch (error) {
      console.error("GoldAPI refresh failed; retaining last successful rates", error.message);
    }
  };

  schedulerTask = cron.schedule("* * * * *", () => { void runIfDue(); });
  void runIfDue();
};

module.exports = {
  getAllMetalRates,
  getMetalRateHistory,
  refreshMetalRatesFromGoldApi,
  startMetalRateScheduler,
};
