import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// Shopify and Purple Dot credentials (use environment variables in production)
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const PURPLE_DOT_API_URL = `${process.env.PURPLE_DOT_API_URL}?api_key=${process.env.PURPLE_DOT_API_KEY}`;

// --- Webhook route ---
app.post("/webhook/product-updated", async (req, res) => {
  try {
    const shopDomain = req.get("X-Shopify-Shop-Domain");
    const product = req.body;
    const { id: productId, handle, title } = product;

    console.log(`🔔 Received product update for: ${title} (${handle}) from ${shopDomain}`);

    // 1️⃣ Fetch preorder details from Purple Dot API (public)
    const purpleDotResponse = await axios.get(`${PURPLE_DOT_API_URL}&handle=${handle}`);
    const preorderData = purpleDotResponse.data?.data?.waitlist;
    const deliveryDate = preorderData?.display_dispatch_date || null;

    if (!deliveryDate) {
      console.log("ℹ️ No preorder info found, skipping metafield update.");
      return res.status(200).send("No preorder data found");
    }

    // 2️⃣ Fetch existing metafields for the product
    const existingMetafieldsResponse = await axios.get(
      `https://${shopDomain}/admin/api/2025-01/products/${productId}/metafields.json`,
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const existingMetafields = existingMetafieldsResponse.data.metafields || [];
    const existingField = existingMetafields.find(
      (m) => m.namespace === "custom" && m.key === "expected_delivery_date"
    );

    console.log(existingField , existingField.value , "existingField")

    // 3️⃣ Only create metafield if it doesn’t exist or value is empty
    if (existingField && existingField.value) {
      console.log(`✅ Metafield already exists for product ${productId}, skipping update.`);
      return res.status(200).send("Metafield already exists, no update needed.");
    }

    const metafieldPayload = {
      metafield: {
        namespace: "custom",
        key: "expected_delivery_date",
        type: "single_line_text_field",
        value: deliveryDate,
      },
    };

    await axios.post(
      `https://${shopDomain}/admin/api/2025-01/products/${productId}/metafields.json`,
      metafieldPayload,
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`✨ Created metafield for product ${productId}`);
    res.status(200).send("Metafield created successfully");
  } catch (error) {
    console.error("❌ Error processing webhook:", error.response?.data || error.message);
    res.status(500).send("Error updating metafield");
  }
});

// --- Start the server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
