import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// Shopify and Purple Dot credentials (use environment variables in production)
const SHOPIFY_STORE = process.env.SHOPIFY_STORE; // e.g. myshop.myshopify.com
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const PURPLE_DOT_API_URL = `${process.env.PURPLE_DOT_API_URL}?api_key=${process.env.PURPLE_DOT_API_KEY}`; // example URL


// --- Webhook route ---
app.post("/webhook/product-updated", async (req, res) => {
  try {
    const product = req.body;
    const { id: productId, handle, title } = product;

    console.log(`Received product update for: ${title} ${handle} ${productId} `);

    // 1️⃣ Fetch preorder details from Purple Dot API (public)
    const purpleDotResponse = await axios.get(
      `${PURPLE_DOT_API_URL}&handle=${handle}`
    );

    const preorderData = purpleDotResponse.data?.[0]?.waitlist;
    const deliveryDate = preorderData?.display_dispatch_date || null;

    console.log(preorderData)

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

    console.log(`Metafield updated for product ${productId}`);
    res.status(200).send("Metafield updated successfully");
  } catch (error) {
    console.error("Error processing webhook:", error.message);
    res.status(500).send("Error updating metafield");
  }
});

// --- Start the server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));