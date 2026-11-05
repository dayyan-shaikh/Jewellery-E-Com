-- =========================================
-- 0. USERS AND AUTHENTICATION
-- =========================================

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'customer'
        CHECK (role IN ('customer', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE auth_sessions (
    jti VARCHAR(64) PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE customer_sessions (
    session_id VARCHAR(100) PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_expiry ON auth_sessions(expires_at);
CREATE INDEX idx_customer_sessions_user ON customer_sessions(user_id);


-- =========================================
-- 1. PRODUCTS
-- =========================================

CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    metal_type VARCHAR(20) NOT NULL
        CHECK (metal_type IN ('GOLD', 'SILVER', 'PLATINUM')),

    wastage_percentage NUMERIC(5,2) NOT NULL DEFAULT 0
        CHECK (wastage_percentage >= 0),

    making_charge_per_gram NUMERIC(12,2) NOT NULL DEFAULT 0
        CHECK (making_charge_per_gram >= 0),

    has_stones BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- =========================================
-- 2. PRODUCT VARIANTS
-- =========================================

CREATE TABLE product_variants (
    id BIGSERIAL PRIMARY KEY,

    product_id BIGINT NOT NULL
        REFERENCES products(id) ON DELETE RESTRICT,

    sku VARCHAR(50) UNIQUE NOT NULL,
    purity VARCHAR(10) NOT NULL,

    weight_grams NUMERIC(10,3) NOT NULL
        CHECK (weight_grams > 0),

    stone_charge NUMERIC(12,2) DEFAULT 0
        CHECK (stone_charge >= 0),

    stock_quantity INTEGER NOT NULL DEFAULT 0
        CHECK (stock_quantity >= 0),

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =========================================
-- 3. METAL RATES
-- =========================================

CREATE TABLE metal_rates (
    id BIGSERIAL PRIMARY KEY,

    metal_type VARCHAR(20) NOT NULL
        CHECK (metal_type IN ('GOLD', 'SILVER', 'PLATINUM')),

    purity VARCHAR(10) NOT NULL,

    rate_per_gram NUMERIC(14,4) NOT NULL
        CHECK (rate_per_gram > 0),

    currency VARCHAR(3) DEFAULT 'INR',

    source VARCHAR(50) DEFAULT 'DUMMY',

    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (metal_type, purity)
);

CREATE TABLE metal_rate_history (
    id BIGSERIAL PRIMARY KEY,
    metal_type VARCHAR(20) NOT NULL
        CHECK (metal_type IN ('GOLD', 'SILVER', 'PLATINUM')),
    purity VARCHAR(10) NOT NULL,
    rate_per_gram NUMERIC(14,4) NOT NULL CHECK (rate_per_gram > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    source VARCHAR(50) NOT NULL,
    provider_spot_price NUMERIC(16,4),
    provider_timestamp TIMESTAMPTZ,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_metal_rate_history_lookup
ON metal_rate_history(metal_type, purity, recorded_at DESC);


-- =========================================
-- 4. PRICE LOCKS
-- =========================================

CREATE TABLE price_locks (
    id BIGSERIAL PRIMARY KEY,

    session_id VARCHAR(100) NOT NULL,

    product_variant_id BIGINT NOT NULL
        REFERENCES product_variants(id) ON DELETE RESTRICT,

    metal_rate_id BIGINT
        REFERENCES metal_rates(id) ON DELETE SET NULL,

    rate_per_gram NUMERIC(12,2) NOT NULL,

    metal_cost NUMERIC(12,2) NOT NULL,
    wastage_amount NUMERIC(12,2) NOT NULL,
    making_charge NUMERIC(12,2) NOT NULL,
    stone_charge NUMERIC(12,2) NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL,
    gst_amount NUMERIC(12,2) NOT NULL,
    total_price NUMERIC(12,2) NOT NULL,

    locked_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,

    status VARCHAR(20) DEFAULT 'ACTIVE'
        CHECK (status IN (
            'ACTIVE',
            'EXPIRED',
            'CONFIRMED',
            'PENDING_CONFIRMATION',
            'REPLACED'
        )),

    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =========================================
-- 5. CARTS
-- =========================================

CREATE TABLE carts (
    id BIGSERIAL PRIMARY KEY,

    session_id VARCHAR(100) UNIQUE NOT NULL,

    status VARCHAR(20) DEFAULT 'ACTIVE'
        CHECK (status IN (
            'ACTIVE',
            'CONVERTED',
            'ABANDONED'
        )),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- =========================================
-- 6. CART ITEMS
-- =========================================

CREATE TABLE cart_items (
    id BIGSERIAL PRIMARY KEY,

    cart_id BIGINT NOT NULL
        REFERENCES carts(id) ON DELETE CASCADE,

    product_variant_id BIGINT NOT NULL
        REFERENCES product_variants(id) ON DELETE RESTRICT,

    price_lock_id BIGINT NOT NULL
        REFERENCES price_locks(id) ON DELETE RESTRICT,

    quantity INTEGER NOT NULL DEFAULT 1
        CHECK (quantity > 0),

    locked_unit_price NUMERIC(12,2) NOT NULL,

    current_unit_price NUMERIC(12,2),

    price_status VARCHAR(30) DEFAULT 'LOCKED'
        CHECK (price_status IN (
            'LOCKED',
            'PRICE_DECREASED',
            'PRICE_INCREASED_PENDING',
            'CONFIRMED',
            'OUT_OF_STOCK'
        )),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- =========================================
-- 7. ORDERS
-- =========================================

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,

    cart_id BIGINT NOT NULL UNIQUE
        REFERENCES carts(id) ON DELETE RESTRICT,

    session_id VARCHAR(100) NOT NULL,

    total_amount NUMERIC(12,2) NOT NULL,

    status VARCHAR(20) DEFAULT 'PLACED'
        CHECK (status IN (
            'PLACED',
            'CANCELLED'
        )),

    idempotency_key VARCHAR(100) UNIQUE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =========================================
-- 8. ORDER ITEMS
-- =========================================

CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,

    order_id BIGINT NOT NULL
        REFERENCES orders(id) ON DELETE RESTRICT,

    product_variant_id BIGINT NOT NULL
        REFERENCES product_variants(id) ON DELETE RESTRICT,

    product_name VARCHAR(150) NOT NULL,
    metal_type VARCHAR(20) NOT NULL,
    purity VARCHAR(10) NOT NULL,
    weight_grams NUMERIC(10,3) NOT NULL,

    quantity INTEGER NOT NULL,

    unit_price NUMERIC(12,2) NOT NULL,
    total_price NUMERIC(12,2) NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =========================================
-- INDEXES
-- =========================================

CREATE INDEX idx_variants_product
ON product_variants(product_id);

CREATE INDEX idx_price_locks_session
ON price_locks(session_id);

CREATE INDEX idx_price_locks_expiry
ON price_locks(expires_at);

CREATE INDEX idx_cart_items_cart
ON cart_items(cart_id);

CREATE INDEX idx_cart_items_lock
ON cart_items(price_lock_id);

CREATE INDEX idx_orders_session
ON orders(session_id);
