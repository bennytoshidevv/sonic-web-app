-- Super Sonic Delivery – PostgreSQL schema (ERD v7)
--
-- Same design as SonicDelivery_ERD_v6_MySQL.sql, rewritten for PostgreSQL
-- (Cloud SQL for PostgreSQL). Changes from v6:
--   * PostgreSQL syntax: SERIAL ids, CREATE TYPE enums, COMMENT ON, jsonb, timestamptz.
--   * New table: favorite_restaurants (customers "like" restaurants).
--   * CHECK constraints and partial unique indexes for rules the ERD drawing cannot show
--     (ratings 1–5, positive amounts, one primary store per order, one open shift per rider, ...).
--
-- Run:  psql "$DATABASE_URL" -f server/db/schema.sql
-- This file drops and recreates everything, so only run it on a dev/test database.

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- ---------- enum types ----------
CREATE TYPE user_role          AS ENUM ('customer', 'rider', 'operator', 'admin');
CREATE TYPE account_status     AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE availability_status AS ENUM ('available', 'busy', 'offline');
CREATE TYPE open_status        AS ENUM ('open', 'closed');
CREATE TYPE deduction_frequency AS ENUM ('per_delivery', 'per_shift');
CREATE TYPE order_status       AS ENUM ('pending', 'confirmed', 'preparing', 'ready_for_pickup',
                                        'picked_up', 'on_the_way', 'delivered', 'cancelled');
CREATE TYPE delivery_status    AS ENUM ('assigned', 'picked_up', 'on_the_way', 'delivered', 'cancelled');
CREATE TYPE response_status    AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE assignment_end_reason AS ENUM ('reassigned', 'rejected', 'completed', 'cancelled');
CREATE TYPE payment_method     AS ENUM ('cod', 'qr_ph', 'maya', 'gcash', 'card');
CREATE TYPE payment_status     AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE refund_status      AS ENUM ('pending', 'completed', 'rejected');
CREATE TYPE shift_status       AS ENUM ('open', 'closed');
CREATE TYPE payout_method      AS ENUM ('cash', 'gcash');
CREATE TYPE savings_entry_type AS ENUM ('deposit', 'withdrawal');
CREATE TYPE petty_cash_type    AS ENUM ('cash_issued', 'gcash_topup', 'purchase', 'cash_returned', 'adjustment');
CREATE TYPE notification_type  AS ENUM ('order_status', 'rider_assignment', 'payment', 'general');

-- ======================================================================
-- Users and addresses
-- ======================================================================
CREATE TABLE users (
  user_id         SERIAL PRIMARY KEY,
  full_name       varchar(100) NOT NULL,
  email           varchar(150) NOT NULL UNIQUE,
  contact_number  varchar(20)  NOT NULL,
  password_hash   varchar(255) NOT NULL,
  role            user_role    NOT NULL,
  account_status  account_status NOT NULL DEFAULT 'active',
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE rider_profiles (
  user_id             integer PRIMARY KEY REFERENCES users (user_id),
  vehicle_type        varchar(50) NOT NULL,
  plate_number        varchar(20),
  availability_status availability_status NOT NULL DEFAULT 'offline'
);

CREATE TABLE barangays (
  barangay_id       SERIAL PRIMARY KEY,
  barangay_name     varchar(100) NOT NULL,
  city_municipality varchar(100) NOT NULL,
  delivery_fee      numeric(10,2) NOT NULL CHECK (delivery_fee >= 0),
  is_active         boolean NOT NULL DEFAULT true,
  UNIQUE (barangay_name, city_municipality)
);

CREATE TABLE customer_addresses (
  address_id     SERIAL PRIMARY KEY,
  user_id        integer NOT NULL REFERENCES users (user_id),
  barangay_id    integer NOT NULL REFERENCES barangays (barangay_id),
  label          varchar(50),
  street_address varchar(255) NOT NULL,
  landmark       varchar(255),
  is_default     boolean NOT NULL DEFAULT false,
  is_active      boolean NOT NULL DEFAULT true
);
-- A customer has at most one default address (among active ones).
CREATE UNIQUE INDEX one_default_address ON customer_addresses (user_id)
  WHERE is_default AND is_active;

-- ======================================================================
-- Restaurants and menu
-- ======================================================================
CREATE TABLE restaurants (
  restaurant_id  SERIAL PRIMARY KEY,
  name           varchar(150) NOT NULL,
  description    text,
  address        varchar(255) NOT NULL,
  contact_number varchar(20),
  logo_url       varchar(255),
  open_status    open_status NOT NULL DEFAULT 'closed',
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE restaurant_hours (
  hours_id      SERIAL PRIMARY KEY,
  restaurant_id integer  NOT NULL REFERENCES restaurants (restaurant_id),
  day_of_week   smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time     time NOT NULL,
  close_time    time NOT NULL,
  UNIQUE (restaurant_id, day_of_week, open_time)
);

CREATE TABLE cuisine_types (
  cuisine_id   SERIAL PRIMARY KEY,
  cuisine_name varchar(50) NOT NULL UNIQUE
);

CREATE TABLE restaurant_cuisines (
  restaurant_id integer NOT NULL REFERENCES restaurants (restaurant_id),
  cuisine_id    integer NOT NULL REFERENCES cuisine_types (cuisine_id),
  PRIMARY KEY (restaurant_id, cuisine_id)
);

CREATE TABLE menu_categories (
  menu_category_id SERIAL PRIMARY KEY,
  restaurant_id    integer NOT NULL REFERENCES restaurants (restaurant_id),
  category_name    varchar(100) NOT NULL,
  display_order    integer NOT NULL DEFAULT 0,
  is_active        boolean NOT NULL DEFAULT true,
  UNIQUE (restaurant_id, category_name)
);

CREATE TABLE menu_items (
  item_id          SERIAL PRIMARY KEY,
  menu_category_id integer NOT NULL REFERENCES menu_categories (menu_category_id),
  name             varchar(150) NOT NULL,
  description      text,
  price            numeric(10,2) NOT NULL CHECK (price >= 0),
  photo_url        varchar(255),
  is_available     boolean NOT NULL DEFAULT true,
  is_active        boolean NOT NULL DEFAULT true,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- NEW in v7
CREATE TABLE favorite_restaurants (
  user_id       integer NOT NULL REFERENCES users (user_id),
  restaurant_id integer NOT NULL REFERENCES restaurants (restaurant_id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, restaurant_id)
);

-- ======================================================================
-- Cart
-- ======================================================================
CREATE TABLE cart_items (
  user_id  integer NOT NULL REFERENCES users (user_id),
  item_id  integer NOT NULL REFERENCES menu_items (item_id),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

-- ======================================================================
-- Settings (rates, gas tiers, deductions)
-- ======================================================================
CREATE TABLE rate_settings (
  setting_id      SERIAL PRIMARY KEY,
  extra_store_fee numeric(10,2) NOT NULL DEFAULT 10 CHECK (extra_store_fee >= 0),
  rider_share_pct numeric(5,2)  NOT NULL DEFAULT 70 CHECK (rider_share_pct BETWEEN 0 AND 100),
  effective_from  timestamptz NOT NULL DEFAULT now(),
  created_by      integer NOT NULL REFERENCES users (user_id)
);

CREATE TABLE gas_allowance_tiers (
  tier_id          SERIAL PRIMARY KEY,
  min_delivery_fee numeric(10,2) NOT NULL CHECK (min_delivery_fee >= 0),
  max_delivery_fee numeric(10,2) CHECK (max_delivery_fee IS NULL OR max_delivery_fee >= min_delivery_fee),
  allowance_amount numeric(10,2) NOT NULL CHECK (allowance_amount >= 0),
  is_active        boolean NOT NULL DEFAULT true
);

CREATE TABLE deduction_types (
  deduction_type_id SERIAL PRIMARY KEY,
  name              varchar(100) NOT NULL UNIQUE,
  amount            numeric(10,2) NOT NULL CHECK (amount >= 0),
  frequency         deduction_frequency NOT NULL,
  is_rider_savings  boolean NOT NULL DEFAULT false,
  is_active         boolean NOT NULL DEFAULT true
);

-- ======================================================================
-- Orders
-- ======================================================================
CREATE TABLE customer_orders (
  order_id            SERIAL PRIMARY KEY,
  order_number        varchar(30) NOT NULL UNIQUE,
  customer_id         integer NOT NULL REFERENCES users (user_id),
  order_status        order_status NOT NULL DEFAULT 'pending',
  base_delivery_fee   numeric(10,2) NOT NULL CHECK (base_delivery_fee >= 0),
  order_notes         text,
  dropoff_street      varchar(255) NOT NULL,
  dropoff_barangay    varchar(100) NOT NULL,
  dropoff_city        varchar(100) NOT NULL,
  dropoff_landmark    varchar(255),
  cancellation_reason text,
  placed_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_restaurants (
  order_id        integer NOT NULL REFERENCES customer_orders (order_id),
  restaurant_id   integer NOT NULL REFERENCES restaurants (restaurant_id),
  is_primary      boolean NOT NULL DEFAULT false,
  extra_store_fee numeric(10,2) NOT NULL DEFAULT 0 CHECK (extra_store_fee >= 0),
  PRIMARY KEY (order_id, restaurant_id)
);
-- Exactly one primary store per order (the "at most one" half is enforced here,
-- the "at least one" half by the checkout code).
CREATE UNIQUE INDEX one_primary_store ON order_restaurants (order_id) WHERE is_primary;

CREATE TABLE order_items (
  order_item_id SERIAL PRIMARY KEY,
  order_id      integer NOT NULL REFERENCES customer_orders (order_id),
  item_id       integer NOT NULL REFERENCES menu_items (item_id),
  quantity      integer NOT NULL CHECK (quantity > 0),
  unit_price    numeric(10,2) NOT NULL CHECK (unit_price >= 0),
  item_name     varchar(150) NOT NULL,
  UNIQUE (order_id, item_id)
);

CREATE TABLE order_status_history (
  history_id SERIAL PRIMARY KEY,
  order_id   integer NOT NULL REFERENCES customer_orders (order_id),
  status     order_status NOT NULL,
  changed_by integer REFERENCES users (user_id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  remarks    text
);

-- ======================================================================
-- Delivery
-- ======================================================================
CREATE TABLE deliveries (
  delivery_id     SERIAL PRIMARY KEY,
  order_id        integer NOT NULL UNIQUE REFERENCES customer_orders (order_id),
  delivery_status delivery_status NOT NULL DEFAULT 'assigned',
  created_at      timestamptz NOT NULL DEFAULT now(),
  picked_up_at    timestamptz,
  delivered_at    timestamptz
);

CREATE TABLE delivery_assignments (
  assignment_id   SERIAL PRIMARY KEY,
  delivery_id     integer NOT NULL REFERENCES deliveries (delivery_id),
  rider_id        integer NOT NULL REFERENCES rider_profiles (user_id),
  assigned_by     integer NOT NULL REFERENCES users (user_id),
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  response_status response_status NOT NULL DEFAULT 'pending',
  responded_at    timestamptz,
  ended_at        timestamptz,
  end_reason      assignment_end_reason
);
-- Only one current (not ended) rider per delivery.
CREATE UNIQUE INDEX one_active_assignment ON delivery_assignments (delivery_id)
  WHERE ended_at IS NULL;

-- ======================================================================
-- Payment
-- ======================================================================
CREATE TABLE payments (
  payment_id            SERIAL PRIMARY KEY,
  order_id              integer NOT NULL REFERENCES customer_orders (order_id),
  payment_method        payment_method NOT NULL,
  amount                numeric(10,2) NOT NULL CHECK (amount >= 0),
  payment_status        payment_status NOT NULL DEFAULT 'pending',
  provider_reference_id varchar(100) UNIQUE,
  created_at            timestamptz NOT NULL DEFAULT now(),
  paid_at               timestamptz
);

CREATE TABLE payment_webhook_events (
  event_id          SERIAL PRIMARY KEY,
  payment_id        integer REFERENCES payments (payment_id),
  provider_event_id varchar(100) NOT NULL UNIQUE,
  event_type        varchar(100) NOT NULL,
  raw_payload       jsonb NOT NULL,
  received_at       timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz
);

CREATE TABLE refunds (
  refund_id     SERIAL PRIMARY KEY,
  payment_id    integer NOT NULL REFERENCES payments (payment_id),
  amount        numeric(10,2) NOT NULL CHECK (amount > 0),
  reason        text NOT NULL,
  refund_status refund_status NOT NULL DEFAULT 'pending',
  processed_by  integer REFERENCES users (user_id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz
);

-- ======================================================================
-- Rider pay
-- ======================================================================
CREATE TABLE rider_shifts (
  shift_id   SERIAL PRIMARY KEY,
  rider_id   integer NOT NULL REFERENCES rider_profiles (user_id),
  shift_date date NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at   timestamptz,
  status     shift_status NOT NULL DEFAULT 'open',
  UNIQUE (rider_id, shift_date)
);
-- A rider has at most one open shift.
CREATE UNIQUE INDEX one_open_shift ON rider_shifts (rider_id) WHERE status = 'open';

CREATE TABLE delivery_earnings (
  earning_id           SERIAL PRIMARY KEY,
  delivery_id          integer NOT NULL UNIQUE REFERENCES deliveries (delivery_id),
  shift_id             integer NOT NULL REFERENCES rider_shifts (shift_id),
  gas_allowance_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (gas_allowance_amount >= 0),
  rider_share_pct      numeric(5,2)  NOT NULL CHECK (rider_share_pct BETWEEN 0 AND 100),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE applied_deductions (
  applied_deduction_id SERIAL PRIMARY KEY,
  deduction_type_id    integer NOT NULL REFERENCES deduction_types (deduction_type_id),
  shift_id             integer NOT NULL REFERENCES rider_shifts (shift_id),
  earning_id           integer REFERENCES delivery_earnings (earning_id),
  amount               numeric(10,2) NOT NULL CHECK (amount >= 0),
  applied_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shift_settlements (
  settlement_id     SERIAL PRIMARY KEY,
  shift_id          integer NOT NULL UNIQUE REFERENCES rider_shifts (shift_id),
  settled_by        integer NOT NULL REFERENCES users (user_id),
  cash_received     numeric(10,2) NOT NULL DEFAULT 0 CHECK (cash_received >= 0),
  payout_amount     numeric(10,2) NOT NULL DEFAULT 0 CHECK (payout_amount >= 0),
  payout_method     payout_method,
  payout_reference  varchar(100),
  settled_at        timestamptz NOT NULL DEFAULT now(),
  notes             text,
  CHECK (payout_amount = 0 OR payout_method IS NOT NULL)
);

CREATE TABLE rider_savings_entries (
  entry_id             SERIAL PRIMARY KEY,
  rider_id             integer NOT NULL REFERENCES rider_profiles (user_id),
  applied_deduction_id integer UNIQUE REFERENCES applied_deductions (applied_deduction_id),
  entry_type           savings_entry_type NOT NULL,
  amount               numeric(10,2) NOT NULL CHECK (amount > 0),
  processed_by         integer REFERENCES users (user_id),
  note                 text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE petty_cash_transactions (
  txn_id             SERIAL PRIMARY KEY,
  shift_id           integer NOT NULL REFERENCES rider_shifts (shift_id),
  order_id           integer REFERENCES customer_orders (order_id),
  txn_type           petty_cash_type NOT NULL,
  amount             numeric(10,2) NOT NULL CHECK (amount > 0),
  gcash_reference_id varchar(100),
  processed_by       integer NOT NULL REFERENCES users (user_id),
  note               text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ======================================================================
-- Reviews
-- ======================================================================
CREATE TABLE restaurant_reviews (
  review_id     SERIAL PRIMARY KEY,
  order_id      integer  NOT NULL,
  restaurant_id integer  NOT NULL,
  rating        smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, restaurant_id),
  FOREIGN KEY (order_id, restaurant_id) REFERENCES order_restaurants (order_id, restaurant_id)
);

CREATE TABLE rider_reviews (
  review_id  SERIAL PRIMARY KEY,
  order_id   integer  NOT NULL UNIQUE REFERENCES customer_orders (order_id),
  rating     smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ======================================================================
-- System
-- ======================================================================
CREATE TABLE notifications (
  notification_id SERIAL PRIMARY KEY,
  user_id         integer NOT NULL REFERENCES users (user_id),
  order_id        integer REFERENCES customer_orders (order_id),
  type            notification_type NOT NULL,
  message         text NOT NULL,
  is_read         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  read_at         timestamptz
);

CREATE TABLE audit_logs (
  audit_id      SERIAL PRIMARY KEY,
  user_id       integer REFERENCES users (user_id),
  action        varchar(100) NOT NULL,
  target_entity varchar(50)  NOT NULL,
  target_id     integer NOT NULL,
  old_value     jsonb,
  new_value     jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes on foreign keys the app filters by often.
CREATE INDEX ON customer_addresses (user_id);
CREATE INDEX ON menu_items (menu_category_id);
CREATE INDEX ON customer_orders (customer_id);
CREATE INDEX ON customer_orders (order_status);
CREATE INDEX ON order_items (order_id);
CREATE INDEX ON order_status_history (order_id);
CREATE INDEX ON delivery_assignments (rider_id);
CREATE INDEX ON payments (order_id);
CREATE INDEX ON applied_deductions (shift_id);
CREATE INDEX ON petty_cash_transactions (shift_id);
CREATE INDEX ON notifications (user_id, is_read);

-- ---------- table comments (shown in dbdiagram.io and psql \d+) ----------
COMMENT ON TABLE users IS 'One account for all roles: customer, rider, operator, admin (owner).';
COMMENT ON TABLE rider_profiles IS 'Rider-only attributes. Exists only for users with role = rider.';
COMMENT ON TABLE barangays IS 'Company price list: one delivery fee per customer barangay.';
COMMENT ON TABLE customer_addresses IS 'Saved delivery addresses. City comes from the barangay.';
COMMENT ON TABLE restaurants IS 'Partner restaurants. Managed by operators (restaurants do not log in).';
COMMENT ON TABLE restaurant_hours IS 'Weekly opening schedule.';
COMMENT ON TABLE cuisine_types IS 'Lookup: Fast food, Filipino, Drinks, etc.';
COMMENT ON TABLE restaurant_cuisines IS 'Associative: restaurants <-> cuisine_types (M:N).';
COMMENT ON TABLE menu_categories IS 'Per-restaurant menu sections (Meals, Drinks, Desserts).';
COMMENT ON TABLE menu_items IS 'Orderable items. Restaurant is reached through the category (3NF).';
COMMENT ON TABLE favorite_restaurants IS 'Associative: customers <-> restaurants they liked (M:N). New in v7.';
COMMENT ON TABLE cart_items IS 'Customer cart. Primary store = restaurant of the earliest added item.';
COMMENT ON TABLE rate_settings IS 'Configurable rates with history. The latest effective row applies to new orders and deliveries.';
COMMENT ON TABLE gas_allowance_tiers IS 'Gas allowance by barangay delivery fee range (extra-store fees excluded).';
COMMENT ON TABLE deduction_types IS 'Rider deductions: Operator fee (per delivery), Box rent (per shift), Rider savings (per shift).';
COMMENT ON TABLE customer_orders IS 'Order header. Totals are calculated from order_items and order_restaurants.';
COMMENT ON TABLE order_restaurants IS 'Associative: orders <-> restaurants (M:N). One primary store plus any number of extra stores.';
COMMENT ON TABLE order_items IS 'Associative: orders <-> menu_items (M:N) with frozen name and price.';
COMMENT ON TABLE order_status_history IS 'Every status change: which status, when, and who.';
COMMENT ON TABLE deliveries IS 'Fulfilment record (one per order) with its own status.';
COMMENT ON TABLE delivery_assignments IS 'Rider history of a delivery. Current rider = row with ended_at null.';
COMMENT ON TABLE payments IS 'One payment attempt (retries allowed). COD stays pending until the rider collects the cash.';
COMMENT ON TABLE payment_webhook_events IS 'Raw PayMongo events for auditing and debugging.';
COMMENT ON TABLE refunds IS 'Refund tracking.';
COMMENT ON TABLE rider_shifts IS 'One shift per rider per day. Groups earnings, deductions, petty cash, and the settlement.';
COMMENT ON TABLE delivery_earnings IS 'Frozen pay inputs per delivered order.';
COMMENT ON TABLE applied_deductions IS 'A deduction charged to a rider in a shift.';
COMMENT ON TABLE shift_settlements IS 'End-of-shift settlement: cash handed over and, when Sonic owes the rider, the payout.';
COMMENT ON TABLE rider_savings_entries IS 'Savings ledger. Balance = deposits - withdrawals (calculated).';
COMMENT ON TABLE petty_cash_transactions IS 'Petty cash ledger per shift. On hand is calculated.';
COMMENT ON TABLE restaurant_reviews IS 'Rating of one restaurant in a delivered order. One per order per restaurant.';
COMMENT ON TABLE rider_reviews IS 'Rating of the rider of a delivered order.';
COMMENT ON TABLE notifications IS 'In-app notifications only.';
COMMENT ON TABLE audit_logs IS 'Audit trail: menu/price edits, user edits, and changes to fees, rates, tiers, and deductions.';
