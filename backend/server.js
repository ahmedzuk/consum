// =========================
// Imports & Initialization
// =========================
const express = require("express");
const cors = require("cors");
const pool = require("./database/config");
const initDatabase = require("./database/init");

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// Middleware
// =========================
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static("frontend"));

// =========================
// Database Initialization
// =========================
initDatabase();

// =========================
// Client Routes
// =========================

// fetch client by id (for editing)
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

// soft delete client by setting is_active = false
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
    res.json({ message: "Client deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
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

app.post("/api/clients", async (req, res) => {
  try {
    const { name, code, address, phone, email } = req.body;
    // Sanitize input to prevent special character issues
    const sanitizedCode = code.replace(/[^a-zA-Z0-9\-_]/g, "");

    // look for existing inactive client with same code or name
    const existing = await pool.query(
      "SELECT * FROM clients WHERE (code = $1 OR name = $2) AND is_active = false",
      [sanitizedCode, name],
    );
    let client;
    if (existing.rows.length > 0) {
      // reactivate and update
      const id = existing.rows[0].id;
      const upd = await pool.query(
        "UPDATE clients SET name = $1, code = $2, address=$3, phone=$4, email=$5, is_active = true, updated_at = NOW() WHERE id = $6 RETURNING *",
        [name, sanitizedCode, address, phone, email, id],
      );
      client = upd.rows[0];
    } else {
      const result = await pool.query(
        "INSERT INTO clients (name, code, address, phone, email) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [name, sanitizedCode, address, phone, email],
      );
      client = result.rows[0];
    }

    res.status(201).json(client);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// =========================
// Product Routes
// =========================
app.get("/api/products", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM products WHERE is_active = true ORDER BY id",
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// soft delete product
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
    res.json({ message: "Product deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get product by ID (for editing)
app.get("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM products WHERE id = $1", [
      id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/products", async (req, res) => {
  try {
    const { name, code, unit, general_price } = req.body;
    // Sanitize inputs
    const sanitizedCode = code.replace(/[^a-zA-Z0-9\-_]/g, "");
    const sanitizedUnit = unit || "T";

    // check for existing product with same name or code (active or inactive)
    const existing = await pool.query(
      "SELECT * FROM products WHERE name = $1 OR code = $2",
      [name, sanitizedCode],
    );
    let product;
    const priceVal = general_price && general_price > 0 ? general_price : 0;
    if (existing.rows.length > 0) {
      // If inactive, reactivate and update; if active, return error
      const existingProduct = existing.rows[0];
      if (!existingProduct.is_active) {
        const id = existingProduct.id;
        const upd = await pool.query(
          "UPDATE products SET name = $1, code = $2, unit = $3, price = $4, is_active = true, updated_at = NOW() WHERE id = $5 RETURNING *",
          [name, sanitizedCode, sanitizedUnit, priceVal, id],
        );
        product = upd.rows[0];
      } else {
        return res
          .status(400)
          .json({ error: "Product with this name or code already exists." });
      }
    } else {
      // Insert product normally
      const productResult = await pool.query(
        "INSERT INTO products (name, code, unit, price) VALUES ($1, $2, $3, $4) RETURNING *",
        [name, sanitizedCode, sanitizedUnit, priceVal],
      );
      product = productResult.rows[0];
    }

    // ensure default/general price table stays in sync
    if (priceVal > 0 && product.id) {
      await pool.query(
        `INSERT INTO general_prices (product_id, price) VALUES ($1, $2)
         ON CONFLICT (product_id) DO UPDATE SET price = $2, updated_at = NOW()`,
        [product.id, priceVal],
      );
    }

    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, unit, general_price } = req.body;
    // Sanitize inputs
    const sanitizedCode = code.replace(/[^a-zA-Z0-9\-_]/g, "");
    const sanitizedUnit = unit || "T";

    // Update product
    const productResult = await pool.query(
      "UPDATE products SET name = $1, code = $2, unit = $3, updated_at = NOW() WHERE id = $4 RETURNING *",
      [name, sanitizedCode, sanitizedUnit, id],
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    const product = productResult.rows[0];

    // Update general price if provided
    if (general_price !== undefined && general_price >= 0) {
      if (general_price > 0) {
        await pool.query(
          "INSERT INTO general_prices (product_id, price) VALUES ($1, $2) ON CONFLICT (product_id) DO UPDATE SET price = $2, updated_at = NOW()",
          [product.id, general_price],
        );
      } else {
        // Remove general price if set to 0 or negative
        await pool.query("DELETE FROM general_prices WHERE product_id = $1", [
          product.id,
        ]);
      }
    }

    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- General Prices Routes ---
app.get("/api/general-prices", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT gp.*, p.name as product_name, p.code as product_code
      FROM general_prices gp
      JOIN products p ON gp.product_id = p.id
      ORDER BY p.id
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/general-prices/product/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    const result = await pool.query(
      "SELECT * FROM general_prices WHERE product_id = $1",
      [productId],
    );
    res.json(result.rows[0] || { price: 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Client Prices Routes (Simplified) ---
app.get("/api/client-prices/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const result = await pool.query(
      `
      SELECT cp.*, p.name as product_name
      FROM client_prices cp
      JOIN products p ON cp.product_id = p.id
      WHERE cp.client_id = $1
      ORDER BY p.id
    `,
      [clientId],
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/client-prices", async (req, res) => {
  try {
    const { client_id, product_id, price, apply_to_existing } = req.body;

    // Set client-specific price
    const result = await pool.query(
      `
      INSERT INTO client_prices (client_id, product_id, price) 
      VALUES ($1, $2, $3) 
      ON CONFLICT (client_id, product_id) 
      DO UPDATE SET price = $3, updated_at = NOW()
      RETURNING *
    `,
      [client_id, product_id, price],
    );

    // Apply to existing entries if requested
    if (apply_to_existing) {
      // This would recalculate existing entries - implement as needed
      console.log("Apply to existing entries requested");
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- Consumption Routes ---
app.get("/api/consumption/:date", async (req, res) => {
  try {
    const { date } = req.params;
    const result = await pool.query(
      `
      SELECT 
        ce.*, 
        c.name as client_name, 
        p.name as product_name, 
        p.unit,
        COALESCE(cp.price, catp.price, gp.price, 0) as unit_price,
        ce.quantity * COALESCE(cp.price, catp.price, gp.price, 0) as total_amount
      FROM consumption_entries ce
      JOIN clients c ON ce.client_id = c.id
      JOIN products p ON ce.product_id = p.id
      LEFT JOIN client_prices cp ON cp.client_id = ce.client_id AND cp.product_id = ce.product_id
      LEFT JOIN client_price_assignments cpa ON cpa.client_id = ce.client_id
      LEFT JOIN category_prices catp ON catp.category_id = cpa.category_id AND catp.product_id = ce.product_id
      LEFT JOIN general_prices gp ON gp.product_id = ce.product_id
      WHERE ce.entry_date = $1
      ORDER BY c.name, p.id
    `,
      [date],
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
      unit_price,
      total_amount,
    } = req.body;

    // calculate price if not provided, using unified helper
    let uprice = unit_price;
    let tamount = total_amount;
    if (uprice === undefined || tamount === undefined) {
      const priceVal = await getClientProductPrice(client_id, product_id);
      uprice = priceVal;
      tamount = uprice * quantity;
    }

    // Sanitize inputs
    const sanitizedNotes = notes ? notes.replace(/[<>'"&]/g, "") : null;

    // Generate sequence number if not provided
    let seqNumber = sequence_number;
    if (!seqNumber) {
      const dateObj = new Date();
      const year = dateObj.getFullYear();
      const countResult = await pool.query(
        "SELECT COUNT(*) as count FROM consumption_entries WHERE EXTRACT(YEAR FROM entry_date) = $1",
        [year],
      );
      const count = parseInt(countResult.rows[0].count) + 1;
      seqNumber = `${String(count).padStart(3, "0")}/${year}`;
    }

    // check for inactive duplicate
    const existing = await pool.query(
      "SELECT * FROM consumption_entries WHERE entry_date=$1 AND client_id=$2 AND product_id=$3 AND is_active=false",
      [entry_date, client_id, product_id],
    );
    let result;
    if (existing.rows.length > 0) {
      const id = existing.rows[0].id;
      result = await pool.query(
        `UPDATE consumption_entries
         SET quantity=$1, unit_price=$2, total_amount=$3, sequence_number=$4, notes=$5, is_active=true, updated_at=NOW()
         WHERE id=$6 RETURNING *`,
        [quantity, uprice, tamount, seqNumber, sanitizedNotes, id],
      );
    } else {
      result = await pool.query(
        "INSERT INTO consumption_entries (entry_date, client_id, product_id, quantity, unit_price, total_amount, sequence_number, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
        [
          entry_date,
          client_id,
          product_id,
          quantity,
          uprice,
          tamount,
          seqNumber,
          sanitizedNotes,
        ],
      );
    }
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// soft-delete consumption entry
app.delete("/api/consumption/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE consumption_entries SET is_active=false, updated_at=NOW() WHERE id=$1 RETURNING *",
      [id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entry not found" });
    }
    res.json({ message: "Entry deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Reports Routes ---
app.get("/api/reports/client/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const { start_date, end_date, group_by } = req.query;

    let query, params;

    if (group_by === "daily") {
      // Daily detailed report
      query = `
        SELECT 
          ce.entry_date,
          p.name as product_name,
          p.unit,
          ce.quantity,
          COALESCE(cp.price, catp.price, gp.price, 0) as unit_price,
          ce.quantity * COALESCE(cp.price, catp.price, gp.price, 0) as total_amount,
          ce.notes
        FROM consumption_entries ce
        JOIN products p ON ce.product_id = p.id
        LEFT JOIN client_prices cp ON cp.client_id = ce.client_id AND cp.product_id = ce.product_id
        LEFT JOIN client_price_assignments cpa ON cpa.client_id = ce.client_id
        LEFT JOIN category_prices catp ON catp.category_id = cpa.category_id AND catp.product_id = ce.product_id
        LEFT JOIN general_prices gp ON gp.product_id = ce.product_id
        WHERE ce.client_id = $1 
        AND ce.entry_date BETWEEN $2 AND $3
        ORDER BY ce.entry_date, p.id
      `;
      params = [clientId, start_date, end_date];
    } else {
      // Monthly summary report
      query = `
        SELECT 
          DATE_TRUNC('month', ce.entry_date) as month,
          p.name as product_name,
          p.unit,
          SUM(ce.quantity) as total_quantity,
          COALESCE(cp.price, catp.price, gp.price, 0) as unit_price,
          SUM(ce.quantity) * COALESCE(cp.price, catp.price, gp.price, 0) as total_amount
        FROM consumption_entries ce
        JOIN products p ON ce.product_id = p.id
        LEFT JOIN client_prices cp ON cp.client_id = ce.client_id AND cp.product_id = ce.product_id
        LEFT JOIN client_price_assignments cpa ON cpa.client_id = ce.client_id
        LEFT JOIN category_prices catp ON catp.category_id = cpa.category_id AND catp.product_id = ce.product_id
        LEFT JOIN general_prices gp ON gp.product_id = ce.product_id
        WHERE ce.client_id = $1 
        AND ce.entry_date BETWEEN $2 AND $3
        GROUP BY DATE_TRUNC('month', ce.entry_date), p.name, p.unit, cp.price, catp.price, gp.price
        ORDER BY month, p.id
      `;
      params = [clientId, start_date, end_date];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/reports/client-summary/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const { start_date, end_date } = req.query;

    // Get total consumption value
    const consumptionResult = await pool.query(
      `
      SELECT 
        SUM(ce.quantity * COALESCE(cp.price, catp.price, gp.price, 0)) as total_consumption_value
      FROM consumption_entries ce
      LEFT JOIN client_prices cp ON cp.client_id = ce.client_id AND cp.product_id = ce.product_id
      LEFT JOIN client_price_assignments cpa ON cpa.client_id = ce.client_id
      LEFT JOIN category_prices catp ON catp.category_id = cpa.category_id AND catp.product_id = ce.product_id
      LEFT JOIN general_prices gp ON gp.product_id = ce.product_id
      WHERE ce.client_id = $1 
      AND ce.entry_date BETWEEN $2 AND $3
    `,
      [clientId, start_date, end_date],
    );

    // Get total payments
    const paymentsResult = await pool.query(
      `
      SELECT SUM(amount) as total_payments
      FROM client_payments
      WHERE client_id = $1 
      AND payment_date BETWEEN $2 AND $3
    `,
      [clientId, start_date, end_date],
    );

    const totalConsumption = parseFloat(
      consumptionResult.rows[0]?.total_consumption_value || 0,
    );
    const totalPayments = parseFloat(
      paymentsResult.rows[0]?.total_payments || 0,
    );
    const balance = totalPayments - totalConsumption;

    res.json({
      total_consumption_value: totalConsumption,
      total_payments: totalPayments,
      balance: balance,
      status: balance >= 0 ? "Credit" : "Debt",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/reports/payments/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const { start_date, end_date } = req.query;

    const result = await pool.query(
      `
      SELECT 
        cp.payment_date,
        cp.amount,
        cp.original_amount,
        pt.name as payment_type,
        cp.notes
      FROM client_payments cp
      JOIN payment_types pt ON cp.payment_type_id = pt.id
      WHERE cp.client_id = $1 
      AND cp.payment_date BETWEEN $2 AND $3
      ORDER BY cp.payment_date DESC
    `,
      [clientId, start_date, end_date],
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Utility Routes ---
app.get("/api/sequence/next", async (req, res) => {
  try {
    const dateObj = new Date();
    const year = dateObj.getFullYear();
    const countResult = await pool.query(
      "SELECT COUNT(*) as count FROM consumption_entries WHERE EXTRACT(YEAR FROM entry_date) = $1",
      [year],
    );
    const count = parseInt(countResult.rows[0].count) + 1;
    const sequence_number = `${String(count).padStart(3, "0")}/${year}`;
    res.json({ sequence_number });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Add these new routes for the enhanced pricing system

// --- Price Categories Routes ---
app.get("/api/price-categories", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM price_categories ORDER BY name",
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/price-categories", async (req, res) => {
  try {
    const { name, description } = req.body;
    const result = await pool.query(
      "INSERT INTO price_categories (name, description) VALUES ($1, $2) RETURNING *",
      [name, description],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/api/price-categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const result = await pool.query(
      "UPDATE price_categories SET name = $1, description = $2 WHERE id = $3 RETURNING *",
      [name, description, id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Price category not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- Category Prices Routes ---
// Unified endpoint to set prices for all products in a pricing set (category)
app.post("/api/prices", async (req, res) => {
  try {
    const { category_id, prices } = req.body; // prices: [{product_id, price}]
    if (!category_id || !Array.isArray(prices)) {
      return res
        .status(400)
        .json({ error: "category_id and prices array required" });
    }
    // Only allow prices for existing products
    const productIdsResult = await pool.query("SELECT id FROM products");
    const validProductIds = new Set(productIdsResult.rows.map((r) => r.id));
    for (const { product_id, price } of prices) {
      if (!validProductIds.has(product_id)) continue;
      await pool.query(
        `INSERT INTO category_prices (category_id, product_id, price)
         VALUES ($1, $2, $3)
         ON CONFLICT (category_id, product_id)
         DO UPDATE SET price = $3, updated_at = NOW()`,
        [category_id, product_id, price],
      );
    }
    res.json({ message: "Prices updated for category." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to trigger recalculation of previous consumption for a category (stub)
app.post("/api/prices/recalculate", async (req, res) => {
  // TODO: Implement recalculation logic based on category_id and optional date range
  res.json({ message: "Recalculation triggered (not yet implemented)." });
});
app.get("/api/category-prices/:categoryId", async (req, res) => {
  try {
    const { categoryId } = req.params;
    // return a row for every product, including those without a price set for this category
    const result = await pool.query(
      `
      SELECT p.id as product_id,
             p.name as product_name,
             p.code as product_code,
             COALESCE(cp.price, 0) as price,
             cp.id as category_price_id
      FROM products p
      LEFT JOIN category_prices cp
        ON cp.product_id = p.id AND cp.category_id = $1
      ORDER BY p.id
    `,
      [categoryId],
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/category-prices", async (req, res) => {
  try {
    const { category_id, product_id, price } = req.body;
    const result = await pool.query(
      `
      INSERT INTO category_prices (category_id, product_id, price) 
      VALUES ($1, $2, $3) 
      ON CONFLICT (category_id, product_id) 
      DO UPDATE SET price = $3, updated_at = NOW()
      RETURNING *
    `,
      [category_id, product_id, price],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/api/category-prices/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { price } = req.body;
    const result = await pool.query(
      "UPDATE category_prices SET price = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [price, id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Category price not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- Client Price Assignment Routes ---
app.get("/api/client-price-assignment/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const result = await pool.query(
      `
      SELECT cpa.*, pc.name as category_name
      FROM client_price_assignments cpa
      JOIN price_categories pc ON cpa.category_id = pc.id
      WHERE cpa.client_id = $1
    `,
      [clientId],
    );
    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/client-price-assignment", async (req, res) => {
  try {
    const { client_id, category_id } = req.body;
    const result = await pool.query(
      `
      INSERT INTO client_price_assignments (client_id, category_id) 
      VALUES ($1, $2) 
      ON CONFLICT (client_id) 
      DO UPDATE SET category_id = $2, updated_at = NOW()
      RETURNING *
    `,
      [client_id, category_id],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// helper used throughout for consistent pricing logic
const getClientProductPrice = async (clientId, productId) => {
  const result = await pool.query(
    `
      SELECT COALESCE(cp.price, catp.price, gp.price, 0) AS price
      FROM products p
      LEFT JOIN client_prices cp ON cp.client_id = $1 AND cp.product_id = $2
      LEFT JOIN client_price_assignments cpa ON cpa.client_id = $1
      LEFT JOIN category_prices catp ON catp.category_id = cpa.category_id AND catp.product_id = $2
      LEFT JOIN general_prices gp ON gp.product_id = $2
      WHERE p.id = $2
    `,
    [clientId, productId],
  );
  return result.rows[0]?.price || 0;
};

// --- Get Product Price for Client ---
app.get("/api/client-product-price/:clientId/:productId", async (req, res) => {
  try {
    const { clientId, productId } = req.params;
    const price = await getClientProductPrice(clientId, productId);
    res.json({ price });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- All existing routes remain the same ---

// Add this AT THE BOTTOM of your server.js file, before the module.exports or at the end:

// ⚠️ TEMPORARY RESET ENDPOINT - Remove after development
app.post("/api/reset-database", async (req, res) => {
  try {
    await pool.query(`
      DROP TABLE IF EXISTS client_payments CASCADE;
      DROP TABLE IF EXISTS consumption_entries CASCADE;
      DROP TABLE IF EXISTS client_price_assignments CASCADE;
      DROP TABLE IF EXISTS client_prices CASCADE;
      DROP TABLE IF EXISTS category_prices CASCADE;
      DROP TABLE IF EXISTS general_prices CASCADE;
      DROP TABLE IF EXISTS price_categories CASCADE;
      DROP TABLE IF EXISTS payment_types CASCADE;
      DROP TABLE IF EXISTS products CASCADE;
      DROP TABLE IF EXISTS clients CASCADE;
      DROP TABLE IF EXISTS system_settings CASCADE;
    `);

    // Reinitialize database with new schema
    await initDatabase(); // This will recreate all tables

    res.json({ message: "Database reset successfully! All tables recreated." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

console.log(
  "TEMPORARY RESET ENDPOINT ADDED - Remember to remove after development",
);

// Health check
app.get("/", (req, res) => {
  res.send(`
    <h1>Consumption Management API</h1>
    <p>API Endpoints:</p>
    <ul>
      <li>GET /api/clients</li>
      <li>POST /api/clients</li>
      <li>GET /api/products</li>
      <li>POST /api/products</li>
      <li>GET /api/general-prices</li>
      <li>POST /api/client-prices</li>
      <li>GET /api/consumption/:date</li>
      <li>POST /api/consumption</li>
      <li>GET /api/reports/client/:clientId?start_date=&end_date=&group_by=daily|monthly</li>
      <li>GET /api/reports/client-summary/:clientId?start_date=&end_date=</li>
      <li>GET /api/reports/payments/:clientId?start_date=&end_date=</li>
    </ul>
  `);
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
