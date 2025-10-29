import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const PURPLE_DOT_API_URL = `${process.env.PURPLE_DOT_API_URL}?api_key=${process.env.PURPLE_DOT_API_KEY}`;

app.post("/webhook/product-updated", async (req, res) => {
  try {
    const shopDomain = req.get("X-Shopify-Shop-Domain");
    const product = req.body;
    const { id: productId, handle, title } = product;

    console.log(`🔔 Received product update for: ${title} (${handle}) from ${shopDomain}`);

    // 1️⃣ Fetch preorder details from Purple Dot API
    const purpleDotResponse = await axios.get(`${PURPLE_DOT_API_URL}&handle=${handle}`);
    const preorderData = purpleDotResponse.data?.data?.waitlist;
    const deliveryDate = preorderData?.display_dispatch_date || null;

    if (!deliveryDate) {
      console.log("ℹ️ No preorder info found, skipping metafield update.");
      return res.status(200).send("No preorder data found");
    }

    // 2️⃣ Check if metafield already exists and matches
    const existingMetafields = await axios.get(
      `https://${shopDomain}/admin/api/2025-01/products/${productId}/metafields.json`,
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const existingField = existingMetafields.data.metafields.find(
      (m) => m.namespace === "custom" && m.key === "expected_delivery_date"
    );

    if (existingField && existingField.value === deliveryDate) {
      console.log(`✅ Metafield already up-to-date for product ${productId}`);
      return res.status(200).send("Metafield already correct");
    }

    // 3️⃣ Update or create metafield only if needed
    const metafieldPayload = {
      metafield: {
        namespace: "custom",
        key: "expected_delivery_date",
        type: "single_line_text_field",
        value: deliveryDate,
      },
    };

    if (existingField) {
      await axios.put(
        `https://${shopDomain}/admin/api/2025-01/metafields/${existingField.id}.json`,
        metafieldPayload,
        {
          headers: {
            "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
            "Content-Type": "application/json",
          },
        }
      );
      console.log(`📝 Updated metafield for product ${productId}`);
    } else {
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
    }

    res.status(200).send("Metafield synced successfully");
  } catch (error) {
    console.error("❌ Error processing webhook:", error.message);
    res.status(500).send("Error updating metafield");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
