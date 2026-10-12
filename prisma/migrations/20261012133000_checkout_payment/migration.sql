-- Add the server-side idempotency fingerprint without changing historical orders.
ALTER TABLE "Order" ADD COLUMN "idempotencyKeyHash" TEXT;

CREATE UNIQUE INDEX "Order_userId_idempotencyKeyHash_key"
ON "Order"("userId", "idempotencyKeyHash");
