import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// Shopify and Purple Dot credentials (use environment variables in production)
const SHOPIFY_STORE = process.env.SHOPIFY_STORE; // e.g. myshop.myshopify.com
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const PURPLE_DOT_API_URL = "https://api.purpledotprice.com/v1/preorders"; // example URL
const PURPLE_DOT_API_KEY = process.env.PURPLE_DOT_API_KEY;

// --- Webhook route ---
app.post("/webhook/product-updated", async (req, res) => {
  try {
    const product = req.body;
    console.log(`Received product update for: ${product.title}`);

    const productId = product.id;
    const sku = product.variants?.[0]?.sku;

    // 1️⃣ Fetch preorder details from Purple Dot API
    const purpleDotResponse = await axios.get(`${PURPLE_DOT_API_URL}?sku=${sku}`, {
      headers: { Authorization: `Bearer ${PURPLE_DOT_API_KEY}` },
    });

    const preorderData = purpleDotResponse.data?.[0]; // Adjust based on response shape
    const deliveryDate = preorderData?.deliveryDate || null;

    if (!deliveryDate) {
      console.log("No preorder info found, skipping metafield update.");
      return res.status(200).send("No preorder data found");
    }

    // 2️⃣ Update metafield in Shopify
    const metafieldPayload = {
      metafield: {
        namespace: "custom",
        key: "expected_delivery_date",
        type: "single_line_text_field",
        value: deliveryDate,
      },
    };

    await axios.post(
      `https://${SHOPIFY_STORE}/admin/api/2025-01/products/${productId}/metafields.json`,
      metafieldPayload,
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`✅ Metafield updated for product ${productId}`);
    res.status(200).send("Metafield updated successfully");
  } catch (error) {
    console.error("❌ Error processing webhook:", error.message);
    res.status(500).send("Error updating metafield");
  }
});

// --- Start the server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
