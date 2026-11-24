/* share-card-mission.js — mission share-card generator with the burned-in FTC disclosure
   band (M4, master doc §25.4/§31.4h). Canvas-rendered card; the disclosure band is part of
   the image itself, not an overlay DOM element — it survives screenshots and reposts.
   STAGED — ships with the brand-missions apply (owner approval). */
(function () {
  "use strict";

  /**
   * drawMissionCard({ headline, teaser, brand, user, url }) -> Promise<Blob> (PNG)
   * The card: 1080x1350 (IG portrait), warm paper background, serif headline,
   * brand wordmark, and a BURNED-IN disclosure band across the bottom:
   *   "#PaidPartnership — posted via ai.spaincos.com brand missions"
   * The band is drawn INTO the rasterized image, so every share carries disclosure.
   */
  window.drawMissionCard = function (opts) {
    var W = 1080, H = 1350;
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    var x = c.getContext("2d");

    // background — warm paper
    x.fillStyle = "#F7F4EE"; x.fillRect(0, 0, W, H);
    // top brand band
    x.fillStyle = "#14646B"; x.fillRect(0, 0, W, 96);
    x.fillStyle = "#FFFFFF"; x.font = "600 34px -apple-system, sans-serif";
    x.fillText("ai.spaincos.com", 48, 60);
    // headline (serif, wrapped)
    x.fillStyle = "#1D1F23"; x.font = "600 64px Georgia, serif";
    wrap(x, opts.headline || "What I found", 48, 220, W - 96, 76, 4);
    // teaser
    x.fillStyle = "#4A4E55"; x.font = "400 36px -apple-system, sans-serif";
    wrap(x, opts.teaser || "", 48, 560, W - 96, 48, 3);
    // attribution
    x.fillStyle = "#6B7078"; x.font = "400 30px -apple-system, sans-serif";
    x.fillText("shared by " + (opts.user || "a reader"), 48, H - 240);
    // ---- BURNED-IN DISCLOSURE BAND (the M4 core) ----
    x.fillStyle = "#14646B"; x.fillRect(0, H - 150, W, 150);
    x.fillStyle = "#FFFFFF"; x.font = "700 34px -apple-system, sans-serif";
    x.fillText("#PaidPartnership", 48, H - 90);
    x.font = "400 28px -apple-system, sans-serif";
    x.fillText("Posted via ai.spaincos.com brand missions — " + (opts.brand || "brand"), 48, H - 48);

    return new Promise(function (res) { c.toBlob(res, "image/png"); });
  };

  function wrap(x, text, px, py, maxW, lineH, maxLines) {
    var words = String(text).split(" "), line = "", lines = 0;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i] + " ";
      if (x.measureText(test).width > maxW && line) {
        x.fillText(line, px, py); py += lineH; line = words[i] + " ";
        if (++lines >= maxLines) { x.fillText(line.trim() + "…", px, py); return; }
      } else line = test;
    }
    x.fillText(line.trim(), px, py);
  }
})();
