const { getStore } = require("@netlify/blobs");

exports.handler = async function(event) {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };

  try {
    const body = JSON.parse(event.body || "{}");
    const { name, email, phone, guests, type, message } = body;

    if (!name || !name.trim()) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Name is required" }) };
    }

    const store = getStore({ name: "rsvps", consistency: "strong" });
    const id    = "rsvp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    const entry = {
      id,
      name:    name.trim(),
      email:   (email   || "").trim(),
      phone:   (phone   || "").trim(),
      guests:  (guests  || "0").toString(),
      type:    (type    || "yes"),
      message: (message || "").trim(),
      submittedAt: new Date().toISOString(),
    };

    await store.setJSON(id, entry);
    console.log("Saved RSVP:", id, name);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true, id }) };

  } catch (err) {
    console.error("submit-rsvp error:", err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
