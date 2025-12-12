export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ---- CORS (adjust allowed origins as needed) ----
    const allowedOrigins = new Set([
      "https://gempirecards.com",
      "https://www.gempirecards.com",
      // add your Cardd domain if you want:
      // "https://YOUR-SITE.carrd.co",
    ]);

    const origin = request.headers.get("Origin") || "";
    const corsHeaders = {
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    };

    // If request has an Origin and it's allowed, echo it back.
    // Otherwise, no CORS (keeps it safer).
    if (origin && allowedOrigins.has(origin)) {
      corsHeaders["Access-Control-Allow-Origin"] = origin;
      corsHeaders["Vary"] = "Origin";
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // ---- Health check ----
    if (url.pathname === "/") {
      return new Response("Gempire Discovery API is live", {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    // ---- Search endpoint ----
    // Example: /search?q=pokemon&limit=24
    if (url.pathname === "/search") {
      const q = (url.searchParams.get("q") || "").trim();
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "24", 10), 50);

      if (!q) {
        return new Response(JSON.stringify({ error: "Missing q" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ---- Cache key (varies by q + limit) ----
      const cacheTtlSeconds = 60;
      const cacheKey = new Request(
        `${url.origin}/__cache/search?q=${encodeURIComponent(q)}&limit=${limit}`,
        request
      );

      const cache = caches.default;
      const cached = await cache.match(cacheKey);
      if (cached) return cached;

      // ---- Call eBay Browse Search API ----
      const ebayUrl = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
      ebayUrl.searchParams.set("q", q);
      ebayUrl.searchParams.set("limit", String(limit));

      const ebayRes = await fetch(ebayUrl.toString(), {
        headers: {
          Authorization: `Bearer ${env.EBAY_TOKEN}`,
          "Content-Type": "application/json",
        },
      });

      if (!ebayRes.ok) {
        const text = await ebayRes.text().catch(() => "");
        return new Response(
          JSON.stringify({
            error: "eBay API error",
            status: ebayRes.status,
            details: text.slice(0, 500),
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const data = await ebayRes.json();

      // ---- EPN tracking settings ----
      const CAMPID = "5339113253";
      const UL_REF =
        "https://rover.ebay.com/rover/1/711-53200-19255-0/1";

      // Helper: build your affiliate link (keeps original item URL + adds tracking)
      function buildAffiliateLink(itemWebUrl) {
        if (!itemWebUrl) return null;

        const base = new URL(itemWebUrl);

        // Ensure EPN params exist
        base.searchParams.set("mkcid", "1");
        base.searchParams.set("mkrid", "711-53200-19255-0");
        base.searchParams.set("siteid", "0");
        base.searchParams.set("campid", CAMPID);
        base.searchParams.set("customid", "");
        base.searchParams.set("toolid", "10001");
        base.searchParams.set("mkevt", "1");

        // Your app-helper parameter
        base.searchParams.set("ul_ref", UL_REF);

        return base.toString();
      }

      // ---- Clean response shape ----
      const items = (data.itemSummaries || []).map((item) => {
        const priceVal = item?.price?.value ?? null;
        const currency = item?.price?.currency ?? null;

        // pick a decent image
        const image =
          item?.image?.imageUrl ||
          item?.thumbnailImages?.[0]?.imageUrl ||
          null;

        const itemWebUrl = item?.itemWebUrl || null;

        return {
          id: item?.itemId || null,
          title: item?.title || null,
          price: priceVal ? String(priceVal) : null,
          currency,
          image,
          condition: item?.condition || null,
          seller: item?.seller?.username || null,
          link: itemWebUrl ? buildAffiliateLink(itemWebUrl) : null,
        };
      });

      const body = JSON.stringify({
        q,
        limit,
        count: items.length,
        items,
      });

      const response = new Response(body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${cacheTtlSeconds}`,
        },
      });

      // Save to edge cache
      ctx.waitUntil(cache.put(cacheKey, response.clone()));

      return response;
    }

    return new Response("Not found", {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  },
};
