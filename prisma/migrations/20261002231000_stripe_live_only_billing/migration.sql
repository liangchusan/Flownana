-- Preview and local still use this project database. Prevent stale deployments
-- from recreating sandbox reservations or subscriptions after the live cutover.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."CheckoutReservation"'::regclass
      AND conname = 'CheckoutReservation_live_price_only') THEN
    ALTER TABLE public."CheckoutReservation"
      ADD CONSTRAINT "CheckoutReservation_live_price_only" CHECK ("stripePriceId" IN (
        'price_1UM5q4RohkvhKuAJ8Ie0xeqr', 'price_1UM5q5RohkvhKuAJlKiHNcAE',
        'price_1UM5q6RohkvhKuAJsH1qPH5S', 'price_1UM5q6RohkvhKuAJhbgmCUHY',
        'price_1UM5q7RohkvhKuAJ4WYA3IsS', 'price_1UM5q8RohkvhKuAJl70A7Jhi'
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public."Subscription"'::regclass
      AND conname = 'Subscription_live_price_only') THEN
    ALTER TABLE public."Subscription"
      ADD CONSTRAINT "Subscription_live_price_only" CHECK ("stripePriceId" IN (
        'price_1UM5q4RohkvhKuAJ8Ie0xeqr', 'price_1UM5q5RohkvhKuAJlKiHNcAE',
        'price_1UM5q6RohkvhKuAJsH1qPH5S', 'price_1UM5q6RohkvhKuAJhbgmCUHY',
        'price_1UM5q7RohkvhKuAJ4WYA3IsS', 'price_1UM5q8RohkvhKuAJl70A7Jhi'
      ));
  END IF;
END $$;
