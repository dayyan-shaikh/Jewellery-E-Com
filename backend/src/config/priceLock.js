const configuredMinutes = Number(process.env.PRICE_LOCK_DURATION_MINUTES || 10);

const PRICE_LOCK_DURATION_MINUTES = Number.isInteger(configuredMinutes)
  && configuredMinutes >= 1
  && configuredMinutes <= 1440
  ? configuredMinutes
  : 10;

module.exports = { PRICE_LOCK_DURATION_MINUTES };
