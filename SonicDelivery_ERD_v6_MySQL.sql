CREATE TABLE `users` (
  `user_id` int PRIMARY KEY AUTO_INCREMENT,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(150) UNIQUE NOT NULL,
  `contact_number` varchar(20) NOT NULL,
  `password_hash` varchar(255) NOT NULL COMMENT 'bcrypt hash, never plain text',
  `role` ENUM ('customer', 'rider', 'operator', 'admin') NOT NULL,
  `account_status` ENUM ('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active' COMMENT 'soft delete via inactive/suspended',
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE `rider_profiles` (
  `user_id` int PRIMARY KEY COMMENT 'same as users.user_id (1:1)',
  `vehicle_type` varchar(50) NOT NULL,
  `plate_number` varchar(20),
  `availability_status` ENUM ('available', 'busy', 'offline') NOT NULL DEFAULT 'offline'
);

CREATE TABLE `barangays` (
  `barangay_id` int PRIMARY KEY AUTO_INCREMENT,
  `barangay_name` varchar(100) NOT NULL,
  `city_municipality` varchar(100) NOT NULL,
  `delivery_fee` decimal(10,2) NOT NULL COMMENT 'current fee; copied to the order at checkout',
  `is_active` boolean NOT NULL DEFAULT true
);

CREATE TABLE `customer_addresses` (
  `address_id` int PRIMARY KEY AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `barangay_id` int NOT NULL,
  `label` varchar(50) COMMENT 'e.g. Home, Work',
  `street_address` varchar(255) NOT NULL,
  `landmark` varchar(255),
  `is_default` boolean NOT NULL DEFAULT false,
  `is_active` boolean NOT NULL DEFAULT true COMMENT 'soft delete'
);

CREATE TABLE `restaurants` (
  `restaurant_id` int PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `description` text,
  `address` varchar(255) NOT NULL COMMENT 'pickup address',
  `contact_number` varchar(20),
  `logo_url` varchar(255),
  `open_status` ENUM ('open', 'closed') NOT NULL DEFAULT 'closed' COMMENT 'manual open/closed toggle',
  `is_active` boolean NOT NULL DEFAULT true COMMENT 'enable/disable and soft delete',
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE `restaurant_hours` (
  `hours_id` int PRIMARY KEY AUTO_INCREMENT,
  `restaurant_id` int NOT NULL,
  `day_of_week` smallint NOT NULL COMMENT '0 = Sunday ... 6 = Saturday',
  `open_time` time NOT NULL,
  `close_time` time NOT NULL
);

CREATE TABLE `cuisine_types` (
  `cuisine_id` int PRIMARY KEY AUTO_INCREMENT,
  `cuisine_name` varchar(50) UNIQUE NOT NULL
);

CREATE TABLE `restaurant_cuisines` (
  `restaurant_id` int NOT NULL,
  `cuisine_id` int NOT NULL,
  PRIMARY KEY (`restaurant_id`, `cuisine_id`)
);

CREATE TABLE `menu_categories` (
  `menu_category_id` int PRIMARY KEY AUTO_INCREMENT,
  `restaurant_id` int NOT NULL,
  `category_name` varchar(100) NOT NULL,
  `display_order` int NOT NULL DEFAULT 0,
  `is_active` boolean NOT NULL DEFAULT true
);

CREATE TABLE `menu_items` (
  `item_id` int PRIMARY KEY AUTO_INCREMENT,
  `menu_category_id` int NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` text,
  `price` decimal(10,2) NOT NULL COMMENT 'current price; copied to order_items at checkout',
  `photo_url` varchar(255),
  `is_available` boolean NOT NULL DEFAULT true COMMENT 'false = sold out',
  `is_active` boolean NOT NULL DEFAULT true COMMENT 'soft delete',
  `updated_at` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE `cart_items` (
  `user_id` int NOT NULL COMMENT 'the customer',
  `item_id` int NOT NULL,
  `quantity` int NOT NULL DEFAULT 1,
  `added_at` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`user_id`, `item_id`)
);

CREATE TABLE `rate_settings` (
  `setting_id` int PRIMARY KEY AUTO_INCREMENT,
  `extra_store_fee` decimal(10,2) NOT NULL DEFAULT 10 COMMENT 'per additional store; goes 100% to the rider',
  `rider_share_pct` decimal(5,2) NOT NULL DEFAULT 70 COMMENT 'Sonic share = 100 minus this',
  `effective_from` timestamp NOT NULL DEFAULT (now()),
  `created_by` int NOT NULL COMMENT 'admin'
);

CREATE TABLE `gas_allowance_tiers` (
  `tier_id` int PRIMARY KEY AUTO_INCREMENT,
  `min_delivery_fee` decimal(10,2) NOT NULL COMMENT 'inclusive, e.g. 151',
  `max_delivery_fee` decimal(10,2) COMMENT 'inclusive; null = no upper limit (600 and up)',
  `allowance_amount` decimal(10,2) NOT NULL,
  `is_active` boolean NOT NULL DEFAULT true
);

CREATE TABLE `deduction_types` (
  `deduction_type_id` int PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(100) UNIQUE NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `frequency` ENUM ('per_delivery', 'per_shift') NOT NULL,
  `is_rider_savings` boolean NOT NULL DEFAULT false COMMENT 'true = deposited to rider savings',
  `is_active` boolean NOT NULL DEFAULT true
);

CREATE TABLE `customer_orders` (
  `order_id` int PRIMARY KEY AUTO_INCREMENT,
  `order_number` varchar(30) UNIQUE NOT NULL COMMENT 'human-readable reference',
  `customer_id` int NOT NULL,
  `order_status` ENUM ('pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending' COMMENT 'current status; full history in order_status_history',
  `base_delivery_fee` decimal(10,2) NOT NULL COMMENT 'snapshot of the barangay fee at checkout',
  `order_notes` text,
  `dropoff_street` varchar(255) NOT NULL COMMENT 'address snapshot',
  `dropoff_barangay` varchar(100) NOT NULL COMMENT 'address snapshot',
  `dropoff_city` varchar(100) NOT NULL COMMENT 'address snapshot',
  `dropoff_landmark` varchar(255) COMMENT 'address snapshot',
  `cancellation_reason` text,
  `placed_at` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE `order_restaurants` (
  `order_id` int NOT NULL,
  `restaurant_id` int NOT NULL,
  `is_primary` boolean NOT NULL DEFAULT false,
  `extra_store_fee` decimal(10,2) NOT NULL DEFAULT 0 COMMENT 'snapshot: 0 for primary, rate for each extra store',
  PRIMARY KEY (`order_id`, `restaurant_id`)
);

CREATE TABLE `order_items` (
  `order_item_id` int PRIMARY KEY AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `item_id` int NOT NULL,
  `quantity` int NOT NULL,
  `unit_price` decimal(10,2) NOT NULL COMMENT 'price snapshot',
  `item_name` varchar(150) NOT NULL COMMENT 'name snapshot'
);

CREATE TABLE `order_status_history` (
  `history_id` int PRIMARY KEY AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `status` ENUM ('pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way', 'delivered', 'cancelled') NOT NULL,
  `changed_by` int COMMENT 'null = system or webhook',
  `changed_at` timestamp NOT NULL DEFAULT (now()),
  `remarks` text
);

CREATE TABLE `deliveries` (
  `delivery_id` int PRIMARY KEY AUTO_INCREMENT,
  `order_id` int UNIQUE NOT NULL,
  `delivery_status` ENUM ('assigned', 'picked_up', 'on_the_way', 'delivered', 'cancelled') NOT NULL DEFAULT 'assigned',
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `picked_up_at` timestamp,
  `delivered_at` timestamp
);

CREATE TABLE `delivery_assignments` (
  `assignment_id` int PRIMARY KEY AUTO_INCREMENT,
  `delivery_id` int NOT NULL,
  `rider_id` int NOT NULL,
  `assigned_by` int NOT NULL COMMENT 'operator or admin',
  `assigned_at` timestamp NOT NULL DEFAULT (now()),
  `response_status` ENUM ('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
  `responded_at` timestamp,
  `ended_at` timestamp COMMENT 'null = active assignment',
  `end_reason` ENUM ('reassigned', 'rejected', 'completed', 'cancelled')
);

CREATE TABLE `payments` (
  `payment_id` int PRIMARY KEY AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `payment_method` ENUM ('cod', 'qr_ph', 'maya', 'gcash', 'card') NOT NULL,
  `amount` decimal(10,2) NOT NULL COMMENT 'amount charged in this attempt',
  `payment_status` ENUM ('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  `provider_reference_id` varchar(100) UNIQUE COMMENT 'PayMongo reference; null for COD',
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `paid_at` timestamp
);

CREATE TABLE `payment_webhook_events` (
  `event_id` int PRIMARY KEY AUTO_INCREMENT,
  `payment_id` int COMMENT 'null if the event matches no payment',
  `provider_event_id` varchar(100) UNIQUE NOT NULL COMMENT 'prevents duplicate processing',
  `event_type` varchar(100) NOT NULL,
  `raw_payload` json NOT NULL,
  `received_at` timestamp NOT NULL DEFAULT (now()),
  `processed_at` timestamp
);

CREATE TABLE `refunds` (
  `refund_id` int PRIMARY KEY AUTO_INCREMENT,
  `payment_id` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `reason` text NOT NULL,
  `refund_status` ENUM ('pending', 'completed', 'rejected') NOT NULL DEFAULT 'pending',
  `processed_by` int,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `processed_at` timestamp
);

CREATE TABLE `rider_shifts` (
  `shift_id` int PRIMARY KEY AUTO_INCREMENT,
  `rider_id` int NOT NULL,
  `shift_date` date NOT NULL,
  `started_at` timestamp NOT NULL DEFAULT (now()),
  `ended_at` timestamp COMMENT 'null = shift still open',
  `status` ENUM ('open', 'closed') NOT NULL DEFAULT 'open'
);

CREATE TABLE `delivery_earnings` (
  `earning_id` int PRIMARY KEY AUTO_INCREMENT,
  `delivery_id` int UNIQUE NOT NULL,
  `shift_id` int NOT NULL,
  `gas_allowance_amount` decimal(10,2) NOT NULL DEFAULT 0 COMMENT 'snapshot from gas_allowance_tiers',
  `rider_share_pct` decimal(5,2) NOT NULL COMMENT 'snapshot from rate_settings',
  `created_at` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE `applied_deductions` (
  `applied_deduction_id` int PRIMARY KEY AUTO_INCREMENT,
  `deduction_type_id` int NOT NULL,
  `shift_id` int NOT NULL,
  `earning_id` int COMMENT 'set only for per-delivery deductions',
  `amount` decimal(10,2) NOT NULL COMMENT 'snapshot of the amount charged',
  `applied_at` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE `shift_settlements` (
  `settlement_id` int PRIMARY KEY AUTO_INCREMENT,
  `shift_id` int UNIQUE NOT NULL,
  `settled_by` int NOT NULL COMMENT 'operator or admin',
  `cash_received` decimal(10,2) NOT NULL DEFAULT 0 COMMENT 'COD cash actually handed over by the rider',
  `payout_amount` decimal(10,2) NOT NULL DEFAULT 0 COMMENT 'amount Sonic actually paid the rider (when net pay > COD collected)',
  `payout_method` ENUM ('cash', 'gcash') COMMENT 'set when payout_amount > 0',
  `payout_reference` varchar(100) COMMENT 'GCash reference when paid by GCash',
  `settled_at` timestamp NOT NULL DEFAULT (now()),
  `notes` text
);

CREATE TABLE `rider_savings_entries` (
  `entry_id` int PRIMARY KEY AUTO_INCREMENT,
  `rider_id` int NOT NULL,
  `applied_deduction_id` int UNIQUE COMMENT 'set for automatic deposits',
  `entry_type` ENUM ('deposit', 'withdrawal') NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `processed_by` int COMMENT 'null = automatic deposit',
  `note` text,
  `created_at` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE `petty_cash_transactions` (
  `txn_id` int PRIMARY KEY AUTO_INCREMENT,
  `shift_id` int NOT NULL COMMENT 'rider comes from the shift',
  `order_id` int COMMENT 'set for purchase rows',
  `txn_type` ENUM ('cash_issued', 'gcash_topup', 'purchase', 'cash_returned', 'adjustment') NOT NULL,
  `amount` decimal(10,2) NOT NULL COMMENT 'always positive; txn_type decides the direction',
  `gcash_reference_id` varchar(100) COMMENT 'set for gcash_topup rows',
  `processed_by` int NOT NULL,
  `note` text,
  `created_at` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE `restaurant_reviews` (
  `review_id` int PRIMARY KEY AUTO_INCREMENT,
  `order_id` int NOT NULL,
  `restaurant_id` int NOT NULL,
  `rating` smallint NOT NULL COMMENT '1 to 5',
  `comment` text,
  `created_at` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE `rider_reviews` (
  `review_id` int PRIMARY KEY AUTO_INCREMENT,
  `order_id` int UNIQUE NOT NULL,
  `rating` smallint NOT NULL COMMENT '1 to 5',
  `comment` text,
  `created_at` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE `notifications` (
  `notification_id` int PRIMARY KEY AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `order_id` int,
  `type` ENUM ('order_status', 'rider_assignment', 'payment', 'general') NOT NULL,
  `message` text NOT NULL,
  `is_read` boolean NOT NULL DEFAULT false,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `read_at` timestamp
);

CREATE TABLE `audit_logs` (
  `audit_id` int PRIMARY KEY AUTO_INCREMENT,
  `user_id` int COMMENT 'null = system',
  `action` varchar(100) NOT NULL,
  `target_entity` varchar(50) NOT NULL COMMENT 'table name (polymorphic, not a true FK)',
  `target_id` int NOT NULL,
  `old_value` json,
  `new_value` json,
  `created_at` timestamp NOT NULL DEFAULT (now())
);

CREATE UNIQUE INDEX `barangays_index_0` ON `barangays` (`barangay_name`, `city_municipality`);

CREATE UNIQUE INDEX `restaurant_hours_index_1` ON `restaurant_hours` (`restaurant_id`, `day_of_week`, `open_time`);

CREATE UNIQUE INDEX `menu_categories_index_2` ON `menu_categories` (`restaurant_id`, `category_name`);

CREATE UNIQUE INDEX `order_items_index_3` ON `order_items` (`order_id`, `item_id`);

CREATE UNIQUE INDEX `rider_shifts_index_4` ON `rider_shifts` (`rider_id`, `shift_date`);

CREATE UNIQUE INDEX `restaurant_reviews_index_5` ON `restaurant_reviews` (`order_id`, `restaurant_id`);

ALTER TABLE `users` COMMENT = 'One account for all roles: customer, rider, operator, admin (owner).';

ALTER TABLE `rider_profiles` COMMENT = 'Rider-only attributes. Exists only for users with role = rider.';

ALTER TABLE `barangays` COMMENT = 'Company price list: one delivery fee per customer barangay.';

ALTER TABLE `customer_addresses` COMMENT = 'Saved delivery addresses. City comes from the barangay.';

ALTER TABLE `restaurants` COMMENT = 'Partner restaurants. Managed by operators (restaurants do not log in).';

ALTER TABLE `restaurant_hours` COMMENT = 'Weekly opening schedule.';

ALTER TABLE `cuisine_types` COMMENT = 'Lookup: Fast food, Filipino, Drinks, etc.';

ALTER TABLE `restaurant_cuisines` COMMENT = 'Associative: restaurants <-> cuisine_types (M:N).';

ALTER TABLE `menu_categories` COMMENT = 'Per-restaurant menu sections (Meals, Drinks, Desserts).';

ALTER TABLE `menu_items` COMMENT = 'Orderable items. Restaurant is reached through the category (3NF).';

ALTER TABLE `cart_items` COMMENT = 'Customer cart. Stores in the cart come from the items (no limit). Primary store = restaurant of the earliest added item.';

ALTER TABLE `rate_settings` COMMENT = 'Configurable rates with history. The latest effective row applies to new orders and deliveries.';

ALTER TABLE `gas_allowance_tiers` COMMENT = 'Gas allowance by barangay delivery fee range (extra-store fees excluded). Below the lowest tier = no allowance.';

ALTER TABLE `deduction_types` COMMENT = 'Rider deductions: Operator fee (per delivery), Box rent (per shift), Rider savings (per shift).';

ALTER TABLE `customer_orders` COMMENT = 'Order header. Totals are calculated from order_items and order_restaurants.';

ALTER TABLE `order_restaurants` COMMENT = 'Associative: orders <-> restaurants (M:N). One primary store plus any number of extra stores.';

ALTER TABLE `order_items` COMMENT = 'Associative: orders <-> menu_items (M:N) with frozen name and price.';

ALTER TABLE `order_status_history` COMMENT = 'Every status change: which status, when, and who. Confirmed/delivered times come from here.';

ALTER TABLE `deliveries` COMMENT = 'Fulfilment record (one per order) with its own status, separate from the order status.';

ALTER TABLE `delivery_assignments` COMMENT = 'Rider history of a delivery. Current rider = row with ended_at null. The rider of the completed row collected the COD cash.';

ALTER TABLE `payments` COMMENT = 'One payment attempt (retries allowed). COD stays pending until the rider collects the cash.';

ALTER TABLE `payment_webhook_events` COMMENT = 'Raw PayMongo events for auditing and debugging.';

ALTER TABLE `refunds` COMMENT = 'Refund tracking.';

ALTER TABLE `rider_shifts` COMMENT = 'One shift per rider per day. Groups earnings, deductions, petty cash, and the settlement.';

ALTER TABLE `delivery_earnings` COMMENT = 'Frozen pay inputs per delivered order. Shares and gross are calculated from these snapshots + the order.';

ALTER TABLE `applied_deductions` COMMENT = 'A deduction charged to a rider in a shift.';

ALTER TABLE `shift_settlements` COMMENT = 'End-of-shift settlement (one per shift). Records the cash the rider handed over and, when Sonic owes the rider, the payout. Expected amounts are calculated.';

ALTER TABLE `rider_savings_entries` COMMENT = 'Savings ledger. Balance = deposits - withdrawals (calculated).';

ALTER TABLE `petty_cash_transactions` COMMENT = 'Petty cash ledger per shift. On hand = issued + gcash_topup - purchase - returned +/- adjustment (calculated).';

ALTER TABLE `restaurant_reviews` COMMENT = 'Rating of one restaurant in a delivered order. One per order per restaurant.';

ALTER TABLE `rider_reviews` COMMENT = 'Rating of the rider of a delivered order. Rider comes from the completed delivery assignment.';

ALTER TABLE `notifications` COMMENT = 'In-app notifications only.';

ALTER TABLE `audit_logs` COMMENT = 'Audit trail: menu/price edits, user edits, and changes to fees, rates, tiers, and deductions.';

ALTER TABLE `rider_profiles` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

ALTER TABLE `customer_addresses` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

ALTER TABLE `customer_addresses` ADD FOREIGN KEY (`barangay_id`) REFERENCES `barangays` (`barangay_id`);

ALTER TABLE `restaurant_hours` ADD FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`restaurant_id`);

ALTER TABLE `restaurant_cuisines` ADD FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`restaurant_id`);

ALTER TABLE `restaurant_cuisines` ADD FOREIGN KEY (`cuisine_id`) REFERENCES `cuisine_types` (`cuisine_id`);

ALTER TABLE `menu_categories` ADD FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`restaurant_id`);

ALTER TABLE `menu_items` ADD FOREIGN KEY (`menu_category_id`) REFERENCES `menu_categories` (`menu_category_id`);

ALTER TABLE `cart_items` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

ALTER TABLE `cart_items` ADD FOREIGN KEY (`item_id`) REFERENCES `menu_items` (`item_id`);

ALTER TABLE `rate_settings` ADD FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`);

ALTER TABLE `customer_orders` ADD FOREIGN KEY (`customer_id`) REFERENCES `users` (`user_id`);

ALTER TABLE `order_restaurants` ADD FOREIGN KEY (`order_id`) REFERENCES `customer_orders` (`order_id`);

ALTER TABLE `order_restaurants` ADD FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`restaurant_id`);

ALTER TABLE `order_items` ADD FOREIGN KEY (`order_id`) REFERENCES `customer_orders` (`order_id`);

ALTER TABLE `order_items` ADD FOREIGN KEY (`item_id`) REFERENCES `menu_items` (`item_id`);

ALTER TABLE `order_status_history` ADD FOREIGN KEY (`order_id`) REFERENCES `customer_orders` (`order_id`);

ALTER TABLE `order_status_history` ADD FOREIGN KEY (`changed_by`) REFERENCES `users` (`user_id`);

ALTER TABLE `deliveries` ADD FOREIGN KEY (`order_id`) REFERENCES `customer_orders` (`order_id`);

ALTER TABLE `delivery_assignments` ADD FOREIGN KEY (`delivery_id`) REFERENCES `deliveries` (`delivery_id`);

ALTER TABLE `delivery_assignments` ADD FOREIGN KEY (`rider_id`) REFERENCES `rider_profiles` (`user_id`);

ALTER TABLE `delivery_assignments` ADD FOREIGN KEY (`assigned_by`) REFERENCES `users` (`user_id`);

ALTER TABLE `payments` ADD FOREIGN KEY (`order_id`) REFERENCES `customer_orders` (`order_id`);

ALTER TABLE `payment_webhook_events` ADD FOREIGN KEY (`payment_id`) REFERENCES `payments` (`payment_id`);

ALTER TABLE `refunds` ADD FOREIGN KEY (`payment_id`) REFERENCES `payments` (`payment_id`);

ALTER TABLE `refunds` ADD FOREIGN KEY (`processed_by`) REFERENCES `users` (`user_id`);

ALTER TABLE `rider_shifts` ADD FOREIGN KEY (`rider_id`) REFERENCES `rider_profiles` (`user_id`);

ALTER TABLE `delivery_earnings` ADD FOREIGN KEY (`delivery_id`) REFERENCES `deliveries` (`delivery_id`);

ALTER TABLE `delivery_earnings` ADD FOREIGN KEY (`shift_id`) REFERENCES `rider_shifts` (`shift_id`);

ALTER TABLE `applied_deductions` ADD FOREIGN KEY (`deduction_type_id`) REFERENCES `deduction_types` (`deduction_type_id`);

ALTER TABLE `applied_deductions` ADD FOREIGN KEY (`shift_id`) REFERENCES `rider_shifts` (`shift_id`);

ALTER TABLE `applied_deductions` ADD FOREIGN KEY (`earning_id`) REFERENCES `delivery_earnings` (`earning_id`);

ALTER TABLE `shift_settlements` ADD FOREIGN KEY (`shift_id`) REFERENCES `rider_shifts` (`shift_id`);

ALTER TABLE `shift_settlements` ADD FOREIGN KEY (`settled_by`) REFERENCES `users` (`user_id`);

ALTER TABLE `rider_savings_entries` ADD FOREIGN KEY (`rider_id`) REFERENCES `rider_profiles` (`user_id`);

ALTER TABLE `rider_savings_entries` ADD FOREIGN KEY (`applied_deduction_id`) REFERENCES `applied_deductions` (`applied_deduction_id`);

ALTER TABLE `rider_savings_entries` ADD FOREIGN KEY (`processed_by`) REFERENCES `users` (`user_id`);

ALTER TABLE `petty_cash_transactions` ADD FOREIGN KEY (`shift_id`) REFERENCES `rider_shifts` (`shift_id`);

ALTER TABLE `petty_cash_transactions` ADD FOREIGN KEY (`order_id`) REFERENCES `customer_orders` (`order_id`);

ALTER TABLE `petty_cash_transactions` ADD FOREIGN KEY (`processed_by`) REFERENCES `users` (`user_id`);

ALTER TABLE `restaurant_reviews` ADD FOREIGN KEY (`order_id`, `restaurant_id`) REFERENCES `order_restaurants` (`order_id`, `restaurant_id`);

ALTER TABLE `rider_reviews` ADD FOREIGN KEY (`order_id`) REFERENCES `customer_orders` (`order_id`);

ALTER TABLE `notifications` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

ALTER TABLE `notifications` ADD FOREIGN KEY (`order_id`) REFERENCES `customer_orders` (`order_id`);

ALTER TABLE `audit_logs` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);
