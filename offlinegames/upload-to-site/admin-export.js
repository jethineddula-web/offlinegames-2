/* admin-export.js — replaces the "Save & exit" download step.
 *
 * Load this AFTER admin-forms.js. It overrides one function rather than
 * editing that file, so admin-forms.js stays untouched.
 *
 * You now get two files instead of one:
 *   catalog.js         -> obfuscated. THIS is what you upload.
 *   catalog.source.js  -> readable master copy. Keep it private, off the site.
 */
(function () {
  "use strict";
  if (!window.AdminForms || !window.SiteAdmin) return;

  var SA = window.SiteAdmin;

  window.AdminForms.downloadCatalog = function (games, news) {
    // Is this build emitting an obfuscated catalog or a readable one? Ask the
    // generator rather than guessing, so this dialog can never describe the
    // wrong thing if the OBFUSCATE switch in site-admin.js gets flipped.
    var built = SA.generateSiteDataJs(games, news);
    var obfuscated = built.indexOf("window.SITE_GAMES = [") < 0;

    SA.openModal(
      '<div class="modal-confirm">' +
        '<div class="modal-header"><h2>Save your changes</h2>' +
        '<button class="modal-close" id="f-close">&#10005;</button></div>' +
        (obfuscated
          ? "<p>You'll get two files:</p>" +
            '<ul style="margin:0 0 18px;padding-left:20px;line-height:1.7;color:var(--muted,#8b93a7);font-size:14px">' +
              "<li><b style=\"color:var(--fg,#e8ecf4)\">catalog.js</b> — obfuscated. Upload this one.</li>" +
              "<li><b style=\"color:var(--fg,#e8ecf4)\">catalog.source.js</b> — readable backup, keep it private.</li>" +
            "</ul>"
          : "<p>Downloads an updated <b>catalog.js</b>. Replace the old file in " +
            "your site folder and upload it, so every page shows the same games " +
            "and pictures.</p>") +
        '<div class="subform-actions">' +
          '<button class="btn btn-primary" id="f-yes">' +
            (obfuscated ? "Download both" : "Download catalog.js") + "</button>" +
          '<button class="btn btn-ghost" id="f-skip">Exit without downloading</button>' +
        "</div>" +
      "</div>"
    );

    document.getElementById("f-close").onclick = SA.closeModal;
    document.getElementById("f-skip").onclick = function () { SA.closeModal(); SA.logout(); };

    document.getElementById("f-yes").onclick = function () {
      // Sanity-check the output before handing it over, so a broken catalog
      // can't reach the site. This counts records textually rather than
      // executing the generated file: running generated code through
      // new Function() is a pattern antivirus heuristics treat as suspicious,
      // and it bought nothing now that the output is a plain literal template.
      var ok = false;
      try {
        var ids = built.match(/^\s{4}id: /gm) || [];
        ok = built.indexOf("window.SITE_GAMES = [") >= 0 &&
             built.indexOf("window.SITE_NEWS = [") >= 0 &&
             ids.length === games.length + news.length;
      } catch (e) { ok = false; }

      if (!ok) {
        SA.showToast("Build check failed — nothing was downloaded. Your edits are still here.", true);
        return;
      }

      SA.downloadText("catalog.js", built);
      if (obfuscated) {
        setTimeout(function () {
          SA.downloadText("catalog.source.js", SA.generateSourceJs(games, news));
        }, 500);
      }

      SA.closeModal();
      SA.showToast(obfuscated
        ? "Downloaded. Upload catalog.js only — keep catalog.source.js private."
        : "Downloaded catalog.js — replace the old file in your site folder.");
    };
  };
})();
