import {
  processOutboxBatch,
  processWebhookDeliveryBatch,
} from "../src/features/integrations/services/outbox-processor";
import { database } from "../src/lib/db/client";
import { logger } from "../src/lib/logging/logger";

async function main() {
  const events = await processOutboxBatch();
  const deliveries = await processWebhookDeliveryBatch();
  logger.info({ events, deliveries }, "Outbox drain completed");
}

main()
  .catch((error: unknown) => {
    logger.fatal({ error }, "Outbox drain failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.$disconnect();
  });
