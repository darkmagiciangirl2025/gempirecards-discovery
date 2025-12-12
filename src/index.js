export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ========= ROOT =========
    if (path === "/") {
      return new Response("Gempire Discovery API is live", { status: 200 });
    }

    // ========= SEARCH =========
    // /search?q=pokemon
    if (path === "/search") {
      const query = url.searchParams.get("q");
      if (!query) {
        return new Response(
          JSON.stringify({ error: "Missing search query" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const ebayUrl = new URL(
        "https://api.ebay.com/buy/browse/v1/item_summary/search"
      );
      ebayUrl.searchParams.set("q", query);
      ebayUrl.searchParams.set("limit", "24");

      const ebayRes = await fetch(ebayUrl.toString(), {
        headers: {
          Authorization: `Bearer ${env.EBAY_TOKEN}`,
          "Content-Type": "application/json",
        },
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

      const items = (data.itemSummaries || []).map((item) => {
        let link = item.itemWebUrl;

        if (link) {
          link +=
            (link.includes("?") ? "&" : "?") +
            `mkcid=1&mkrid=711-53200-19255-0&campid=${CAMPID}&toolid=10001` +
            `&customid=` +
            `&ul_ref=${encodeURIComponent(UL_REF)}`;
        }

        return {
          id: item.itemId,
          title: item.title,
          price: item.price?.value,
          currency: item.price?.currency,
          image: item.image?.imageUrl,
          condition: item.condition,
          seller: item.seller?.username,
          link,
        };
      });

      return new Response(JSON.stringify({ items }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ========= GO REDIRECT =========
    // /go/ITEM_ID
    if (path.startsWith("/go/")) {
      const itemId = path.split("/go/")[1];
      if (!itemId) {
        return new Response("Missing item ID", { status: 400 });
      }

      const CAMPID = "5339113253";
      const UL_REF =
        "https://rover.ebay.com/rover/1/711-53200-19255-0/1";

      const redirectUrl =
        `https://www.ebay.com/itm/${itemId}` +
        `?mkcid=1&mkrid=711-53200-19255-0` +
        `&campid=${CAMPID}&toolid=10001` +
        `&customid=` +
        `&ul_ref=${encodeURIComponent(UL_REF)}`;

      return Response.redirect(redirectUrl, 302);
    }

    return new Response("Not found", { status: 404 });
  },
};
