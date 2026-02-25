// =========================
// Imports
// =========================
const pool = require("./config");

// =========================
// Function Definition
// =========================
const initDatabase = async () => {
  try {
    // use a transaction so the schema is either fully applied or not at all
    await pool.query("BEGIN");
    await pool.query(`
      -- Create tables with proper constraints
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        address TEXT,
        phone VARCHAR(50),
        email VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        code VARCHAR(50) UNIQUE NOT NULL,
        unit VARCHAR(20) DEFAULT 'T',
        price DECIMAL(10,2) NOT NULL DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payment_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE
      );

      -- Price categories/blocks (like General, Discounted, VIP, etc.)
      CREATE TABLE IF NOT EXISTS price_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Actual prices for each product in each category
      CREATE TABLE IF NOT EXISTS category_prices (
        id SERIAL PRIMARY KEY,
        category_id INTEGER REFERENCES price_categories(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(category_id, product_id)
      );

      -- Assign which price category each client uses
      CREATE TABLE IF NOT EXISTS client_price_assignments (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES price_categories(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(client_id)
      );

      -- Table for default/general prices (one per product)
      CREATE TABLE IF NOT EXISTS general_prices (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE UNIQUE,
        price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Table for client-specific override prices
      CREATE TABLE IF NOT EXISTS client_prices (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(client_id, product_id)
      );

      CREATE TABLE IF NOT EXISTS consumption_entries (
        id SERIAL PRIMARY KEY,
        entry_date DATE NOT NULL,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        quantity DECIMAL(10,3) NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL, -- Store actual price used at time of entry
        total_amount DECIMAL(10,2) NOT NULL, -- Store calculated total
        sequence_number VARCHAR(20),
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS client_payments (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        payment_date DATE NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        original_amount DECIMAL(10,2) NOT NULL,
        payment_type_id INTEGER REFERENCES payment_types(id),
        currency VARCHAR(3) DEFAULT 'DA',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Insert initial data
      INSERT INTO payment_types (name) 
      VALUES ('cash'), ('check')
      ON CONFLICT DO NOTHING;

      -- Insert default price category
      INSERT INTO price_categories (name, description) 
      VALUES ('General', 'General pricing for all products')
      ON CONFLICT DO NOTHING;

      -- Insert products in specific order
      INSERT INTO products (id, name, code, unit) VALUES 
      (1, 'SABLE 0/3', '0/3', 'T'),
      (2, 'GRAVIER 3/8', '3/8', 'T'),
      (3, 'GRAVIER 8/15', '8/15', 'T'),
      (4, 'GRAVIER 15/25', '15/25', 'T'),
      (5, 'GRAVE CONCASSE 0/31.5', '0/31.5', 'T'),
      (6, 'TVC 0/25', 'TVC', 'T'),
      (7, 'BLOCAGE 25/50', '25/50', 'T'),
      (8, 'BLOCAGE 0/300', '0/300', 'T')
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name, 
        code = EXCLUDED.code, 
        unit = EXCLUDED.unit;

      -- Reset all id sequences to current maxima to avoid duplicate-key errors
      -- (if table empty we set sequence to 1)
      SELECT setval('clients_id_seq', COALESCE((SELECT MAX(id) FROM clients), 1));
      SELECT setval('products_id_seq', COALESCE((SELECT MAX(id) FROM products), 1));
      SELECT setval('payment_types_id_seq', COALESCE((SELECT MAX(id) FROM payment_types), 1));
      SELECT setval('price_categories_id_seq', COALESCE((SELECT MAX(id) FROM price_categories), 1));
      SELECT setval('category_prices_id_seq', COALESCE((SELECT MAX(id) FROM category_prices), 1));
      SELECT setval('client_price_assignments_id_seq', COALESCE((SELECT MAX(id) FROM client_price_assignments), 1));
      SELECT setval('general_prices_id_seq', COALESCE((SELECT MAX(id) FROM general_prices), 1));
      SELECT setval('client_prices_id_seq', COALESCE((SELECT MAX(id) FROM client_prices), 1));
      SELECT setval('consumption_entries_id_seq', COALESCE((SELECT MAX(id) FROM consumption_entries), 1));
      SELECT setval('client_payments_id_seq', COALESCE((SELECT MAX(id) FROM client_payments), 1));

      -- Insert default general prices (all products get default prices)
      INSERT INTO general_prices (product_id, price)
      SELECT id, 100.00 FROM products
      ON CONFLICT (product_id) DO NOTHING;

      -- Also seed the "General" category with the same base prices so pricing
      -- queries using categories will have data available.
      INSERT INTO category_prices (category_id, product_id, price)
      SELECT 1, gp.product_id, gp.price
      FROM general_prices gp
      ON CONFLICT (category_id, product_id) DO NOTHING;
    `);
    await pool.query("COMMIT");
    console.log("Database initialized successfully");
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("Error initializing database:", error);
  }
};

// =========================
// Export
// =========================
module.exports = initDatabase;
