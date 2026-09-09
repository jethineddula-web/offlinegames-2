window.AdminForms = (function () {
  var SA = function () { return window.SiteAdmin; };

  function toJpegDataUrl(img) {
    var maxW = 640;
    var w = img.naturalWidth || img.width || 1;
    var h = img.naturalHeight || img.height || 1;
    var scale = w > maxW ? maxW / w : 1;
    var canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    var data = canvas.toDataURL("image/jpeg", 0.72);
    if (!data || data.indexOf("data:image/jpeg;base64,") !== 0) {
      throw new Error("canvas");
    }
    return data;
  }

  function fromDataUrl(dataUrl, onDone, onErr) {
    var img = new Image();
    img.onload = function () {
      try { onDone(toJpegDataUrl(img)); }
      catch (e) { onErr("Couldn't convert this image to base64."); }
    };
    img.onerror = function () { onErr("Couldn't read that image."); };
    img.src = dataUrl;
  }

  function convertBlob(blob, onDone, onErr) {
    var reader = new FileReader();
    reader.onload = function () { fromDataUrl(String(reader.result || ""), onDone, onErr); };
    reader.onerror = function () { onErr("Couldn't read that image."); };
    reader.readAsDataURL(blob);
  }

  function convertSrc(src, onDone, onErr) {
    if (!src) { onDone(""); return; }
    src = String(src).trim();
    if (src.indexOf("data:") === 0) {
      fromDataUrl(src, onDone, onErr);
      return;
    }
    if (typeof fetch === "function") {
      fetch(src).then(function (r) {
        if (!r.ok) throw new Error("bad");
        return r.blob();
      }).then(function (blob) {
        convertBlob(blob, onDone, onErr);
      }).catch(function () {
        onErr("Couldn't convert that URL. Choose the image file instead.");
      });
      return;
    }
    onErr("Couldn't convert that URL. Choose the image file instead.");
  }

  function resizeFile(file, onDone, onErr) {
    if (!file) { onErr("No file selected."); return; }
    var ok = !file.type || /^image\//.test(file.type);
    if (!ok) { onErr("That doesn't look like an image file."); return; }
    convertBlob(file, onDone, onErr);
  }

  function bindImageField(currentUrl) {
    var isData = currentUrl && currentUrl.indexOf("data:image") === 0;
    var state = { dataUrl: isData ? currentUrl : null };
    var fileInput = document.getElementById("img-file");
    var choose = document.getElementById("img-choose");
    var convertBtn = document.getElementById("img-convert");
    var remove = document.getElementById("img-remove");
    var previewWrap = document.getElementById("img-preview-wrap");
    var preview = document.getElementById("img-preview");
    var status = document.getElementById("img-status");
    var out = document.getElementById("img-b64");
    var urlInput = document.getElementById("img-url");

    var converting = 0;
    function show(data, note) {
      state.dataUrl = data || null;
      if (out) out.value = data || "";
      if (data) {
        if (preview) preview.src = data;
        if (previewWrap) previewWrap.style.display = "";
        if (remove) remove.style.display = "";
        if (status) {
          status.textContent = (note || "Converted") + " — data:image/jpeg;base64 — " + Math.round(data.length / 1024) + " KB.";
        }
      } else {
        if (previewWrap) previewWrap.style.display = "none";
        if (remove) remove.style.display = "none";
        if (out) out.value = "";
      }
    }

    if (isData) show(currentUrl, "Already base64");

    if (choose && fileInput) choose.addEventListener("click", function () { fileInput.click(); });
    if (fileInput) fileInput.addEventListener("change", function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      converting++;
      if (status) status.textContent = "Converting to data:image/jpeg;base64…";
      resizeFile(file, function (data) {
        converting--;
        show(data, "Converted from file");
        SA().showToast("Image converted to base64. Press Save to replace the old cover.");
      }, function (msg) {
        converting--;
        SA().showToast(msg, true);
        if (status) status.textContent = msg;
      });
    });
    if (convertBtn) convertBtn.addEventListener("click", function () {
      var src = urlInput ? urlInput.value.trim() : "";
      if (!src) { SA().showToast("Paste an image URL or path first.", true); return; }
      converting++;
      if (status) status.textContent = "Converting to data:image/jpeg;base64…";
      convertSrc(src, function (data) {
        converting--;
        show(data, "Converted from URL");
        SA().showToast("Image converted to base64. Press Save to replace the old cover.");
      }, function (msg) {
        converting--;
        SA().showToast(msg, true);
        if (status) status.textContent = msg;
      });
    });
    if (urlInput) urlInput.addEventListener("change", function () {
      if (convertBtn) convertBtn.click();
    });
    if (remove) remove.addEventListener("click", function () {
      show("", "");
      if (fileInput) fileInput.value = "";
      if (urlInput) urlInput.value = "";
      if (status) status.textContent = "Image removed.";
    });

    state.ensure = function (cb) {
      function ready() {
        var boxed = "";
        var live = document.getElementById("img-b64");
        if (live && live.value) boxed = live.value.trim();
        if (!boxed) boxed = (state.dataUrl || "").trim();
        if (boxed.indexOf("data:image") === 0) { cb(boxed); return; }
        var src = urlInput ? urlInput.value.trim() : "";
        if (!src) { cb(""); return; }
        convertSrc(src, function (data) {
          show(data, "Converted");
          cb(data);
        }, function (msg) {
          SA().showToast(msg, true);
          cb("");
        });
      }
      if (converting > 0) {
        var n = 0;
        var t = setInterval(function () {
          n++;
          if (converting <= 0 || n > 80) { clearInterval(t); ready(); }
        }, 100);
        return;
      }
      ready();
    };
    return state;
  }

  function imageFields(currentUrl) {
    var isData = currentUrl && currentUrl.indexOf("data:image") === 0;
    var urlVal = isData ? "" : (currentUrl || "");
    return (
      '<div class="field"><label>Image</label>' +
        '<input type="file" id="img-file" accept="image/*" style="display:none">' +
        '<div id="img-preview-wrap" style="display:none;margin-bottom:10px">' +
          '<img id="img-preview" alt="" style="width:100%;max-height:140px;object-fit:cover;border-radius:8px;display:block">' +
        "</div>" +
        '<button type="button" class="btn btn-ghost" id="img-choose">Choose image from computer…</button>' +
        '<div class="field" style="margin-top:12px">' +
          '<label>Or image URL / path</label>' +
          '<input type="text" id="img-url" value="' + SA().escapeHtml(urlVal) + '" placeholder="https://… or covers/pic.jpg">' +
          '<button type="button" class="btn btn-primary" id="img-convert" style="margin-top:8px">Convert to base64</button>' +
        "</div>" +
        '<label>Base64 (saved into catalog.js)</label>' +
        '<textarea id="img-b64" readonly rows="3" placeholder="data:image/jpeg;base64,…"></textarea>' +
        '<button type="button" class="btn btn-ghost" id="img-remove" style="margin-top:8px;display:none">Remove image</button>' +
        '<div id="img-status" style="color:var(--muted);font-size:12px;margin-top:8px">Pick a file, wait until you see data:image/jpeg;base64, then press Save post.</div>' +
      "</div>"
    );
  }

  function nextCatalog(games) {
    var max = 0;
    games.forEach(function (g) { if ((g.catalog || 0) > max) max = g.catalog; });
    return max + 1;
  }

  function openGameForm(existing, games, onSave) {
    var g = existing || { title: "", description: "", category: "", coverUrl: "", embedUrl: "games/" };
    SA().openModal(
      '<div class="modal-form"><div class="modal-header"><h2>' + (existing ? "Edit Game" : "Add Game") +
      '</h2><button class="modal-close" id="f-close">✕</button></div><form id="f-form">' +
      '<div class="field"><label>Title</label><input type="text" id="f-title" value="' + SA().escapeHtml(g.title) + '"></div>' +
      '<div class="field"><label>Category</label><input type="text" id="f-category" value="' + SA().escapeHtml(g.category) + '" placeholder="Arcade, Puzzle…"></div>' +
      '<div class="field"><label>Library note (shown on library.html)</label><textarea id="f-desc" rows="5" placeholder="A few sentences: what the game is, how it plays, who it is for. Same style as the other library notes.">' + SA().escapeHtml(g.description) + "</textarea></div>" +
      imageFields(g.coverUrl) +
      '<div class="field"><label>Game file path (in games/)</label>' +
        '<input type="text" id="f-embed" value="' + SA().escapeHtml(g.embedUrl) + '" placeholder="games/your-game.html">' +
        '<div style="color:var(--muted);font-size:12px;margin-top:4px">Drop the game in the games folder first, then point to it here.</div></div>' +
      '<div class="subform-actions"><button type="submit" class="btn btn-primary" id="f-save">Save game</button>' +
      '<button type="button" class="btn btn-ghost" id="f-cancel">Cancel</button></div></form></div>'
    );
    document.getElementById("f-close").onclick = SA().closeModal;
    document.getElementById("f-cancel").onclick = SA().closeModal;
    var img = bindImageField(g.coverUrl);
    document.getElementById("f-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var title = document.getElementById("f-title").value.trim();
      var category = document.getElementById("f-category").value.trim();
      var description = document.getElementById("f-desc").value.trim();
      var embedUrl = document.getElementById("f-embed").value.trim();
      if (!title || !category || !embedUrl) {
        SA().showToast("Title, category, and game path are required.", true);
        return;
      }
      var saveBtn = document.getElementById("f-save");
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Converting image…"; }
      img.ensure(function (coverUrl) {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Save game"; }
        if (coverUrl && coverUrl.indexOf("data:image") !== 0) {
          SA().showToast("Image did not convert to base64. Choose the file from your computer.", true);
          return;
        }
        if (embedUrl.indexOf("games/") !== 0 && !/^https?:\/\//i.test(embedUrl)) {
          embedUrl = "games/" + embedUrl.replace(/^\//, "");
        }
        var record = Object.assign({}, existing || {}, {
          id: existing ? existing.id : SA().uid(),
          title: title, category: category, description: description,
          coverUrl: coverUrl || (existing && existing.coverUrl) || "",
          embedUrl: embedUrl,
          catalog: existing ? existing.catalog : nextCatalog(games),
          dateAdded: existing ? existing.dateAdded : new Date().toISOString().slice(0, 10)
        });
        SA().closeModal();
        onSave(record, !existing);
      });
    });
  }

  function openNewsForm(existing, onSave) {
    var a = existing || { title: "", excerpt: "", date: new Date().toISOString().slice(0, 10), image: "", emoji: "📰" };
    SA().openModal(
      '<div class="modal-form"><div class="modal-header"><h2>' + (existing ? "Edit News" : "Add News") +
      '</h2><button class="modal-close" id="f-close">✕</button></div><form id="f-form">' +
      '<div class="field"><label>Title</label><input type="text" id="f-title" value="' + SA().escapeHtml(a.title) + '"></div>' +
      '<div class="field"><label>Date</label><input type="text" id="f-date" value="' + SA().escapeHtml(a.date) + '"></div>' +
      '<div class="field"><label>Emoji (if no image)</label><input type="text" id="f-emoji" value="' + SA().escapeHtml(a.emoji || "📰") + '" maxlength="4"></div>' +
      imageFields(a.image) +
      '<div class="field"><label>Excerpt</label><textarea id="f-excerpt">' + SA().escapeHtml(a.excerpt) + "</textarea></div>" +
      '<div class="subform-actions"><button type="submit" class="btn btn-primary" id="f-save">Save post</button>' +
      '<button type="button" class="btn btn-ghost" id="f-cancel">Cancel</button></div></form></div>'
    );
    document.getElementById("f-close").onclick = SA().closeModal;
    document.getElementById("f-cancel").onclick = SA().closeModal;
    var img = bindImageField(a.image);
    document.getElementById("f-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var title = document.getElementById("f-title").value.trim();
      var excerpt = document.getElementById("f-excerpt").value.trim();
      if (!title || !excerpt) { SA().showToast("Title and excerpt are required.", true); return; }
      var saveBtn = document.getElementById("f-save");
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Converting image…"; }
      img.ensure(function (image) {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Save post"; }
        var boxed = "";
        var live = document.getElementById("img-b64");
        if (live && live.value) boxed = live.value.trim();
        if (!boxed) boxed = image || "";
        if (boxed && boxed.indexOf("data:image") !== 0) {
          SA().showToast("Image did not convert to base64. Choose the file from your computer.", true);
          return;
        }
        if (existing) {
          existing.title = title;
          existing.excerpt = excerpt;
          existing.date = document.getElementById("f-date").value.trim() || existing.date;
          existing.emoji = document.getElementById("f-emoji").value.trim() || "📰";
          if (boxed) existing.image = boxed;
          SA().closeModal();
          onSave(existing, false);
        } else {
          SA().closeModal();
          onSave({
            id: SA().uid(),
            title: title,
            excerpt: excerpt,
            date: document.getElementById("f-date").value.trim() || new Date().toISOString().slice(0, 10),
            emoji: document.getElementById("f-emoji").value.trim() || "📰",
            image: boxed
          }, true);
        }
      });
    });
  }

  function confirmDelete(label, onYes) {
    SA().openModal(
      '<div class="modal-confirm"><div class="modal-header"><h2>Remove?</h2><button class="modal-close" id="f-close">✕</button></div>' +
      "<p>Remove “" + SA().escapeHtml(label) + "”?</p>" +
      '<div class="subform-actions"><button class="btn btn-danger" id="f-yes">Remove</button><button class="btn btn-ghost" id="f-cancel">Cancel</button></div></div>'
    );
    document.getElementById("f-close").onclick = SA().closeModal;
    document.getElementById("f-cancel").onclick = SA().closeModal;
    document.getElementById("f-yes").onclick = function () { SA().closeModal(); onYes(); };
  }

  function downloadCatalog(games, news) {
    SA().openModal(
      '<div class="modal-confirm"><div class="modal-header"><h2>Save your changes</h2><button class="modal-close" id="f-close">✕</button></div>' +
      "<p>Downloads an updated <code>catalog.js</code>. Replace the old file in your site folder so every page (vault, about, news) shows the same games and pictures.</p>" +
      '<div class="subform-actions"><button class="btn btn-primary" id="f-yes">Download catalog.js</button><button class="btn btn-ghost" id="f-skip">Exit without downloading</button></div></div>'
    );
    document.getElementById("f-close").onclick = SA().closeModal;
    document.getElementById("f-skip").onclick = function () { SA().closeModal(); SA().logout(); };
    document.getElementById("f-yes").onclick = function () {
      SA().downloadText("catalog.js", SA().generateSiteDataJs(games, news));
      SA().closeModal();
      SA().showToast("Downloaded catalog.js — it includes the new What's new pictures. Replace the old catalog.js in your folder.");
    };
  }

  return { openGameForm: openGameForm, openNewsForm: openNewsForm, confirmDelete: confirmDelete, downloadCatalog: downloadCatalog };
})();
