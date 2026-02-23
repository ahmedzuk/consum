const express = require("express");
const cors = require("cors");
const pool = require("./database/config");
const initDatabase = require("./database/init");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("frontend"));

// Initialize database
initDatabase();

// --- CLIENT ROUTES ---
app.get("/api/clients", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM clients WHERE is_active = true ORDER BY name",
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/clients/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT * FROM clients WHERE id = $1 AND is_active = true",
      [id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Client not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/clients", async (req, res) => {
  try {
    const { name, code, address, phone, email } = req.body;
    const result = await pool.query(
      "INSERT INTO clients (name, code, address, phone, email) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [name, code, address, phone, email],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/api/clients/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, address, phone, email } = req.body;
    const result = await pool.query(
      "UPDATE clients SET name = $1, code = $2, address = $3, phone = $4, email = $5, updated_at = NOW() WHERE id = $6 RETURNING *",
      [name, code, address, phone, email, id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Client not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/clients/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE clients SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *",
      [id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Client not found" });
    }
    res.json({ message: "Client deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- PRODUCT ROUTES ---
app.get("/api/products", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM products WHERE is_active = true ORDER BY name",
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/products", async (req, res) => {
  try {
    const { name, code, unit } = req.body;
    const result = await pool.query(
      "INSERT INTO products (name, code, unit) VALUES ($1, $2, $3) RETURNING *",
      [name, code, unit || "m³"],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, unit } = req.body;
    const result = await pool.query(
      "UPDATE products SET name = $1, code = $2, unit = $3, updated_at = NOW() WHERE id = $4 RETURNING *",
      [name, code, unit, id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *",
      [id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- PRICING ROUTES ---
app.get("/api/prices/client/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const result = await pool.query(
      `
      SELECT cp.*, p.name as product_name 
      FROM client_prices cp 
      JOIN products p ON cp.product_id = p.id 
      WHERE cp.client_id = $1 AND cp.is_active = true 
      ORDER BY p.name
    `,
      [clientId],
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/prices", async (req, res) => {
  try {
    const { client_id, product_id, price, valid_from, valid_to } = req.body;
    const result = await pool.query(
      `
      INSERT INTO client_prices (client_id, product_id, price, valid_from, valid_to) 
      VALUES ($1, $2, $3, $4, $5) 
      ON CONFLICT (client_id, product_id, valid_from) 
      DO UPDATE SET price = $3, valid_to = $5, updated_at = NOW()
      RETURNING *
    `,
      [client_id, product_id, price, valid_from, valid_to],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- CONSUMPTION ROUTES ---
app.get("/api/consumption/:date", async (req, res) => {
  try {
    const { date } = req.params;
    const result = await pool.query(
      `
      SELECT ce.*, c.name as client_name, p.name as product_name
      FROM consumption_entries ce
      JOIN clients c ON ce.client_id = c.id
      JOIN products p ON ce.product_id = p.id
      WHERE ce.entry_date = $1
      ORDER BY c.name, p.name
    `,
      [date],
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add this after your existing routes:

// --- PAYMENT TYPES ---
app.get("/api/payment-types", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM payment_types ORDER BY name",
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- GET PRODUCT BY ID ---
app.get("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT * FROM products WHERE id = $1 AND is_active = true",
      [id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- GET CLIENT PRICE FOR SPECIFIC DATE ---
app.get(
  "/api/prices/client/:clientId/product/:productId/date/:date",
  async (req, res) => {
    try {
      const { clientId, productId, date } = req.params;

      // First check for client-specific price
      let result = await pool.query(
        `
      SELECT price FROM client_prices 
      WHERE client_id = $1 AND product_id = $2 
      AND valid_from <= $3 
      AND (valid_to IS NULL OR valid_to >= $3)
      AND is_active = true
      ORDER BY valid_from DESC
      LIMIT 1
    `,
        [clientId, productId, date],
      );

      if (result.rows.length > 0) {
        return res.json(result.rows[0]);
      }

      // If no client-specific price, check general price
      result = await pool.query(
        `
      SELECT price FROM client_prices 
      WHERE client_id = 0 AND product_id = $2 
      AND valid_from <= $3 
      AND (valid_to IS NULL OR valid_to >= $3)
      AND is_active = true
      ORDER BY valid_from DESC
      LIMIT 1
    `,
        [clientId, productId, date],
      );

      if (result.rows.length > 0) {
        return res.json(result.rows[0]);
      }

      // No price found
      res.json({ price: 0 });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// --- SET GENERAL PRICE ---
app.post("/api/general-prices", async (req, res) => {
  try {
    const { product_id, price, valid_from, valid_to } = req.body;
    const result = await pool.query(
      `
      INSERT INTO client_prices (client_id, product_id, price, valid_from, valid_to) 
      VALUES (0, $1, $2, $3, $4) 
      ON CONFLICT (client_id, product_id, valid_from) 
      DO UPDATE SET price = $2, valid_to = $4, updated_at = NOW()
      RETURNING *
    `,
      [
        product_id,
        price,
        valid_from || new Date().toISOString().split("T")[0],
        valid_to,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- GET GENERAL PRICES ---
app.get("/api/general-prices", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cp.*, p.name as product_name 
      FROM client_prices cp 
      JOIN products p ON cp.product_id = p.id 
      WHERE cp.client_id = 0 AND cp.is_active = true 
      ORDER BY p.name
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- PAYMENTS ---
app.get("/api/payments/client/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const result = await pool.query(
      `
      SELECT cp.*, pt.name as payment_type_name
      FROM client_payments cp
      JOIN payment_types pt ON cp.payment_type_id = pt.id
      WHERE cp.client_id = $1
      ORDER BY cp.payment_date DESC
    `,
      [clientId],
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/payments", async (req, res) => {
  try {
    const {
      client_id,
      payment_date,
      amount,
      original_amount,
      payment_type_id,
      notes,
    } = req.body;

    // Process amount based on payment type
    let processedAmount = original_amount;
    if (payment_type_id == 2) {
      // Check payment type
      processedAmount = Math.round((original_amount / 1.19) * 100) / 100;
    }

    const result = await pool.query(
      `
      INSERT INTO client_payments (client_id, payment_date, amount, original_amount, payment_type_id, notes)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `,
      [
        client_id,
        payment_date,
        processedAmount,
        original_amount,
        payment_type_id,
        notes,
      ],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/consumption", async (req, res) => {
  try {
    const {
      entry_date,
      client_id,
      product_id,
      quantity,
      sequence_number,
      notes,
    } = req.body;

    // Get next sequence number if not provided
    let seqNumber = sequence_number;
    if (!seqNumber) {
      const settingsResult = await pool.query(
        "SELECT setting_value as current_number, (SELECT setting_value FROM system_settings WHERE setting_key = 'current_year') as year FROM system_settings WHERE setting_key = 'sequence_start_number'",
      );
      const { current_number, year } = settingsResult.rows[0];
      seqNumber = `${String(current_number).padStart(3, "0")}/${year}`;

      // Update sequence number
      await pool.query(
        "UPDATE system_settings SET setting_value = (setting_value::INTEGER + 1)::VARCHAR WHERE setting_key = 'sequence_start_number'",
      );
    }

    const result = await pool.query(
      "INSERT INTO consumption_entries (entry_date, client_id, product_id, quantity, sequence_number, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [entry_date, client_id, product_id, quantity, seqNumber, notes],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get next sequence number
app.get("/api/sequence/next", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        LPAD(setting_value, 3, '0') || '/' || (SELECT setting_value FROM system_settings WHERE setting_key = 'current_year') as next_sequence
      FROM system_settings 
      WHERE setting_key = 'sequence_start_number'
    `);
    res.json({ sequence_number: result.rows[0].next_sequence });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get("/", (req, res) => {
  res.send(`
    <h1>Consumption Management API</h1>
    <p>API Endpoints:</p>
    <ul>
      <li>GET /api/clients</li>
      <li>POST /api/clients</li>
      <li>GET /api/clients/:id</li>
      <li>PUT /api/clients/:id</li>
      <li>DELETE /api/clients/:id</li>
      <li>GET /api/products</li>
      <li>POST /api/products</li>
      <li>GET /api/products/:id</li>
      <li>PUT /api/products/:id</li>
      <li>DELETE /api/products/:id</li>
      <li>GET /api/prices/client/:clientId</li>
      <li>POST /api/prices</li>
      <li>GET /api/consumption/:date</li>
      <li>POST /api/consumption</li>
      <li>GET /api/sequence/next</li>
    </ul>
  `);
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
