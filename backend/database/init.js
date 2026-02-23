const pool = require("./config");

const initDatabase = async () => {
  try {
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
        unit VARCHAR(20) DEFAULT 'T', -- Changed to Tonne
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payment_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS general_prices (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(product_id)
      );

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
        sequence_number VARCHAR(20),
        notes TEXT,
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
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Insert initial data
      INSERT INTO payment_types (name) 
      VALUES ('cash'), ('check')
      ON CONFLICT DO NOTHING;

      -- Insert products in specific order
      INSERT INTO products (id, name, code, unit) VALUES 
      (1, 'SABLE 0/3', 'SBL03', 'T'),
      (2, 'GRAVIER 3/8', 'GRV38', 'T'),
      (3, 'GRAVIER 8/15', 'GRV815', 'T'),
      (4, 'GRAVIER 15/25', 'GRV1525', 'T'),
      (5, 'GRAVE CONCASSE 0/31.5', 'GRC0315', 'T'),
      (6, 'TVC 0/25', 'TVC025', 'T'),
      (7, 'BLOCAGE 25/50', 'BLC2550', 'T'),
      (8, 'BLOCAGE 0/300', 'BLC0300', 'T')
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name, 
        code = EXCLUDED.code, 
        unit = EXCLUDED.unit;
    `);
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
};

module.exports = initDatabase;
