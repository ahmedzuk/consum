const pool = require("./config");

const initDatabase = async () => {
  try {
    await pool.query(`
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
        unit VARCHAR(20) DEFAULT 'm³',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payment_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS client_prices (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        price DECIMAL(10,2) NOT NULL,
        valid_from DATE NOT NULL,
        valid_to DATE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(client_id, product_id, valid_from)
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
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(entry_date, client_id, product_id, sequence_number)
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

      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value VARCHAR(255) NOT NULL,
        description TEXT
      );

      INSERT INTO payment_types (name) 
      VALUES ('cash'), ('check')
      ON CONFLICT DO NOTHING;

      INSERT INTO products (name, code) VALUES 
      ('SABLE 0/3', 'SBL03'),
      ('GRAVIER 3/8', 'GRV38'),
      ('GRAVIER 8/15', 'GRV815'),
      ('GRAVIER 15/25', 'GRV1525'),
      ('GRAVE CONCASSE 0/31.5', 'GRC0315'),
      ('TVC 0/25', 'TVC025'),
      ('BLOCAGE 25/50', 'BLC2550'),
      ('BLOCAGE 0/300', 'BLC0300')
      ON CONFLICT DO NOTHING;

      INSERT INTO system_settings (setting_key, setting_value, description) VALUES
      ('sequence_start_number', '001', 'Starting sequence number for consumption entries'),
      ('current_year', '2026', 'Current year for sequence numbering')
      ON CONFLICT DO NOTHING;
    `);
    // In your initDatabase function, add this:
    await pool.query(`
  -- Ensure client_id 0 exists for general prices (optional)
  INSERT INTO clients (id, name, code) VALUES (0, 'GENERAL_PRICES', 'GEN_PRICE')
  ON CONFLICT (id) DO NOTHING;
`);

    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
};

module.exports = initDatabase;
