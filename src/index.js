export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Simple health check
    if (url.pathname === "/") {
      return new Response("Gempire Discovery API is live", { status: 200 });
    }

    // Example: /search?q=pokemon
    if (url.pathname === "/search") {
      const query = url.searchParams.get("q");
      if (!query) {
        return new Response(
          JSON.stringify({ error: "Missing search query" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const ebayUrl = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
      ebayUrl.searchParams.set("q", query);
      ebayUrl.searchParams.set("limit", "24");

      const ebayRes = await fetch(ebayUrl.toString(), {
        headers: {
          "Authorization": `Bearer ${env.EBAY_TOKEN}`,
          "Content-Type": "application/json"
        }
      });

      if (!ebayRes.ok) {
        return new Response(
          JSON.stringify({ error: "eBay API error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      const data = await ebayRes.json();

      const CAMPID = "5339113253";
      const UL_REF =
        "https://rover.ebay.com/rover/1/711-53200-19255-0/1";

      const items = (data.itemSummaries || []).map(item => {
        let link = item.itemWebUrl;

        if (link) {
          link +=
            (link.includes("?") ? "&" : "?") +
            `mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=${CAMPID}&customid=&toolid=10001&mkevt=1&ul_ref=${encodeURIComponent(
              UL_REF
            )}`;
        }

        return {
          title: item.title,
          price: item.price?.value,
          currency: item.price?.currency,
          image: item.image?.imageUrl,
          condition: item.condition,
          url: link
        };
      });

      return new Response(JSON.stringify({ items }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("Not found", { status: 404 });
  }
};
