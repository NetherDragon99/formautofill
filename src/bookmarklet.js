javascript:(function M(BAKED) {
  var API = "https://script.google.com/macros/s/AKfycbzpd_ftWytnl7SiDK4azmEj9zWQk8jzB09vqdvOnBjd3x08sP19NA8wniHTc8_vCvDUtQ/exec";
  var ID = "sm_all_modal";
  var DEF_SITE = "labeling.robot.car";

  try {
    // 1. إغلاق أي نافذة أو توست مفتوح مسبقاً (Toggle)
    var oldModal = document.getElementById(ID);
    if (oldModal) {
      oldModal.remove();
      return;
    }
    var oldToast = document.getElementById("sm_toast");
    if (oldToast) oldToast.remove();

    // 2. دالة النسخ الآمنة للحافظة (Clipboard Copy with ExecCommand Fallback)
    function copyText(text, cb) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          if (cb) cb(true);
        }).catch(function () {
          fallbackCopy();
        });
      } else {
        fallbackCopy();
      }
      function fallbackCopy() {
        try {
          var ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.top = "0";
          ta.style.left = "0";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          var ok = document.execCommand("copy");
          document.body.removeChild(ta);
          if (cb) cb(ok);
        } catch (e) {
          if (cb) cb(false);
        }
      }
    }

    // 3. طبقة التخزين المحلي الآمن (Safe Local Storage with In-Memory Fallback)
    function jp(s, d) {
      try {
        var v = JSON.parse(s);
        return (v === null || v === undefined) ? d : v;
      } catch (e) {
        return d;
      }
    }

    var store = {
      get: function (k) {
        try {
          return window.localStorage.getItem(k);
        } catch (e) {
          return window["_sm_" + k] || null;
        }
      },
      set: function (k, v) {
        try {
          window.localStorage.setItem(k, v);
        } catch (e) {
          window["_sm_" + k] = v;
        }
      },
      rm: function (k) {
        try {
          window.localStorage.removeItem(k);
        } catch (e) {
          delete window["_sm_" + k];
        }
      }
    };

    function genRev() {
      return Math.random().toString(36).substring(2, 8);
    }

    function emptyCfg() {
      return { url: "", title: "No Form Linked", id: "---", fields: [], mapping: {} };
    }

    function normalizeCfg(c) {
      if (!c || typeof c !== "object") return emptyCfg();
      if (!c.mapping || typeof c.mapping !== "object") c.mapping = {};
      if (!Array.isArray(c.fields)) {
        var arr = [];
        if (c.fields && typeof c.fields === "object") {
          var oo = (c.options && typeof c.options === "object") ? c.options : {};
          Object.keys(c.fields).forEach(function (k) {
            var fid = String(c.fields[k]);
            arr.push({
              id: fid,
              label: k,
              type: 0,
              options: Array.isArray(oo[k]) ? oo[k] : []
            });
            c.mapping[k] = fid;
          });
        }
        c.fields = arr;
      }
      return c;
    }

    // 4. محاولة التقاط إيميل الصفحة إن وُجد
    var detEmail = "";
    try {
      var emEl = document.querySelector("[data-user-email-address]");
      if (emEl) detEmail = emEl.getAttribute("data-user-email-address") || "";
      if (!detEmail) {
        var mEm = document.querySelector('meta[property="og:email"]');
        if (mEm) detEmail = mEm.content || "";
      }
    } catch (e) { }

    // 5. محرك تحليل نماذج جوجل التلقائي (parsePageForm)
    var isForm = location.host.indexOf("docs.google.com") > -1 && location.pathname.indexOf("/forms/") > -1;

    function parsePageForm() {
      if (!isForm) return null;
      try {
        var raw = window.FB_PUBLIC_LOAD_DATA_;
        if (!raw || !raw[1] || !raw[1][1]) return null;

        var cleanPath = location.pathname.replace(/\/(formResponse|edit|prefill).*$/, "/viewform");
        var url = location.origin + cleanPath;
        var title = "Custom Form";
        var tEl = document.querySelector(".F9yp7e");
        if (tEl) {
          title = (tEl.innerText || tEl.textContent || "").trim();
        } else if (document.title) {
          title = document.title.replace(/ - Google Forms$/i, "").trim();
        }

        var m = url.match(/\/forms\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/);
        var fid = m ? m[1] : "Form_" + cleanPath.replace(/[^a-zA-Z0-9]/g, "").slice(-16);
        var p = { url: url, title: title, id: fid, fields: [], mapping: {} };

        raw[1][1].forEach(function (f) {
          if (!f || !Array.isArray(f)) return;
          var label = String(f[1] || "").trim();
          var type = f[3];
          var d = f[4] && f[4][0];
          if (!d) return;

          var id = String(d[0]);
          var opts = Array.isArray(d[1]) ? d[1].map(function (o) { return o && o[0]; }).filter(Boolean) : [];
          p.fields.push({ id: id, label: label, type: type, options: opts });

          var l = label.toLowerCase();
          if (l.indexOf("email") > -1) p.mapping.email = id;
          else if (l.indexOf("name") > -1) p.mapping.name = id;
          else if (l.indexOf("shift") > -1) p.mapping.shift = id;
          else if (l.indexOf("gulp") > -1) p.mapping.gulp = id;
          else if (l.indexOf("webviz") > -1) p.mapping.webviz = id;
          else if ((l.indexOf("road event") > -1 || l.indexOf("segment") > -1) && l.indexOf("email") < 0 && l.indexOf("name") < 0 && l.indexOf("pc") < 0) p.mapping.roadEvent = id;
          else if (l.indexOf("queue") > -1) p.mapping.queue = id;
          else if (l.indexOf("task") > -1 || l.indexOf("type") > -1 || l.indexOf("complain") > -1) p.mapping.taskType = id;
        });

        return p.fields.length ? p : null;
      } catch (e) {
        return null;
      }
    }

    var pageCfg = parsePageForm();

    // 6. نظام المصادقة الهجين والمتنقل (Hybrid Auth)
    function okAuth(a) {
      return a && typeof a === "object" && a.user && (a.pass || a.token);
    }

    var auth = null;
    if (typeof BAKED !== "undefined" && okAuth(BAKED)) {
      auth = { user: BAKED.user, pass: BAKED.pass, token: BAKED.token, baked: true };
    }
    if (!okAuth(auth)) auth = jp(store.get("sm_auth"), null);
    if (!okAuth(auth)) {
      try { auth = jp(window.sessionStorage.getItem("sm_global_auth"), null); } catch (e) { auth = null; }
    }
    if (!okAuth(auth)) {
      try {
        var wn = jp(window.name, null);
        if (okAuth(wn)) auth = wn;
      } catch (e) { }
    }
    if (!okAuth(auth)) auth = null;

    function saveAuth() {
      if (!auth) return;
      var s = JSON.stringify({ user: auth.user, pass: auth.pass, token: auth.token });
      store.set("sm_auth", s);
      try { window.sessionStorage.setItem("sm_global_auth", s); } catch (e) { }
      try { window.name = s; } catch (e) { }
    }

    function clearAuth() {
      store.rm("sm_auth");
      try { window.sessionStorage.removeItem("sm_global_auth"); } catch (e) { }
      try {
        var curWn = jp(window.name, null);
        if (curWn && curWn.user) window.name = "";
      } catch (e) { }
      auth = null;
    }

    if (auth) saveAuth();

    // 7. تحميل الإعدادات المحلية والمزامنة مع صفحة الفورم إن وُجدت
    var cfg = normalizeCfg(jp(store.get("sm_form_cfg"), null));
    var vals = jp(store.get("sm_form_vals"), {});
    if (!vals || typeof vals !== "object" || Array.isArray(vals)) vals = {};
    if (vals.autoOpen === undefined) vals.autoOpen = false;
    if (vals.openMode !== "window" && vals.openMode !== "tab") vals.openMode = "tab";

    var localRev = store.get("sm_rev") || vals._rev || "";

    if (isForm && pageCfg && (!cfg.url || cfg.id !== pageCfg.id)) {
      cfg = normalizeCfg(pageCfg);
      vals = {
        autoOpen: vals.autoOpen,
        openMode: vals.openMode,
        _formCount: vals._formCount || 0,
        _countResetTs: vals._countResetTs || 0,
        _allowedSites: vals._allowedSites
      };
      if (detEmail) vals.email = detEmail;
      localRev = genRev();
      store.set("sm_form_vals", JSON.stringify(vals));
      store.set("sm_form_cfg", JSON.stringify(cfg));
      store.set("sm_rev", localRev);
    }

    if (!localRev && cfg.url) {
      localRev = genRev();
      store.set("sm_rev", localRev);
    }

    var formCount = parseInt(store.get("sm_form_count") || "0", 10);
    if (isNaN(formCount) || formCount < 0) formCount = 0;
    if (typeof vals._formCount === "number" && vals._formCount > formCount) formCount = vals._formCount;

    var countResetTs = parseInt(store.get("sm_count_reset_ts") || vals._countResetTs || "0", 10) || 0;

    var allowedSites = jp(store.get("sm_allowed_sites"), null);
    if (!Array.isArray(allowedSites)) allowedSites = [DEF_SITE];
    if (Array.isArray(vals._allowedSites)) {
      vals._allowedSites.forEach(function (s) {
        if (s && typeof s === "string" && allowedSites.indexOf(s) < 0) allowedSites.push(s);
      });
    }
    if (!store.get("sm_def_removed") && allowedSites.indexOf(DEF_SITE) < 0) allowedSites.unshift(DEF_SITE);

    var pendingUpdate = null;

    function persist(bumpRev) {
      if (bumpRev) {
        localRev = genRev();
        store.set("sm_rev", localRev);
        store.set("sm_sync_ts", String(Date.now()));
      }
      vals._rev = localRev;
      vals._formCount = formCount;
      vals._countResetTs = countResetTs;
      vals._allowedSites = allowedSites;
      store.set("sm_form_count", String(formCount));
      store.set("sm_count_reset_ts", String(countResetTs));
      store.set("sm_allowed_sites", JSON.stringify(allowedSites));
      store.set("sm_form_vals", JSON.stringify(vals));
      if (cfg && cfg.url) store.set("sm_form_cfg", JSON.stringify(cfg));
    }

    // 8. التعرف على بيئة العمل (Gulp / Webviz / Segment ID)
    var webvizEl = document.querySelector('a[href*="webviz.robot.car"]');
    var descEl = document.querySelector(".node-description");
    var isGulp = Boolean(webvizEl || descEl);
    var autoWebviz = webvizEl ? webvizEl.href : "";
    var autoGulp = isGulp ? window.location.href : "";
    var autoSeg = descEl ? descEl.textContent.split("|")[0].trim() : "";
    var hasSel = String(window.getSelection ? window.getSelection() : "").trim().length > 0;

    var now = Date.now();
    var lastRun = parseInt(store.get("sm_last_run") || "0", 10);
    var isDbl = (now - lastRun) < 1500;
    store.set("sm_last_run", String(now));

    // 9. توليد رابط فتح الفورم وتعبئته التلقائية
    function launchUrl(v) {
      if (!cfg || !cfg.url) return null;
      var ps = new URLSearchParams();
      ps.append("usp", "pp_url");

      cfg.fields.forEach(function (f) {
        var val = v[f.id];
        if (!val) {
          var sk = Object.keys(cfg.mapping).filter(function (k) { return cfg.mapping[k] === f.id; })[0];
          if (sk) val = v[sk];
        }
        if (isGulp && !isForm) {
          if (sk === "gulp" && autoGulp) val = autoGulp;
          else if (sk === "webviz" && autoWebviz) val = autoWebviz;
          else if (sk === "roadEvent" && autoSeg) val = autoSeg;
        }
        if (val !== undefined && val !== null && String(val) !== "") {
          ps.append("entry." + f.id, String(val));
        }
      });

      if (autoGulp && !cfg.mapping.gulp) ps.append("gulp_fallback", autoGulp);
      if (autoWebviz && !cfg.mapping.webviz) ps.append("webviz_fallback", autoWebviz);
      if (autoSeg && !cfg.mapping.roadEvent) ps.append("seg_fallback", autoSeg);

      return cfg.url + "?" + ps.toString();
    }

    function openForm(v) {
      var u = launchUrl(v);
      if (!u) return false;
      var win = null;
      try {
        if (v.openMode === "window") {
          var w = 480, h = 740;
          var l = Math.max(0, (window.screen.availWidth || 1024) - w - 20);
          win = window.open(u, "_blank", "width=" + w + ",height=" + h + ",left=" + l + ",top=40,menubar=no,toolbar=no,status=no");
        } else {
          win = window.open(u, "_blank");
        }
      } catch (e) {
        win = null;
      }
      return Boolean(win);
    }

    // 10. محرك الاتصال بالسحابة (API Call with Multi-Fallback)
    var netBlocked = false;

    function apiCall(action, u, p, extra, cb) {
      var done = !1;
      function fin(r) {
        if (done) return;
        done = true;
        clearTimeout(tm);
        if (cb) cb(r);
      }

      var tm = setTimeout(function () {
        fin({ status: "error", msg: "Timeout" });
      }, 10000);

      var payload = { user: u || "" };
      if (p) payload.pass = p;
      else if (auth && auth.token) payload.token = auth.token;
      if (detEmail) payload.email = detEmail;

      if (extra) {
        Object.keys(extra).forEach(function (k) {
          payload[k] = extra[k];
        });
      }

      var body = JSON.stringify(payload);

      // المسار 1: POST طلب مباشر
      fetch(API + "?action=" + encodeURIComponent(action) + "&_t=" + Date.now(), {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: body
      })
      .then(function (r) {
        netBlocked = false;
        return r.json();
      })
      .then(fin)
      .catch(function () {
        // المسار 2: GET query fallback
        var q = API + "?action=" + encodeURIComponent(action) + "&data=" + encodeURIComponent(body) + "&_t=" + Date.now();
        function failFallback() {
          netBlocked = true;
          if (action === "save" && q.length <= 7800) {
            var pw = null;
            try {
              pw = window.open(q, "_blank", "width=420,height=260");
            } catch (e) { }
            if (pw) {
              setTimeout(function () {
                try { pw.close(); } catch (e) { }
              }, 3500);
              return fin({ status: "ok", popup: true });
            }
          }
          fin({ status: "error", msg: "Network/CORS blocked by this site" });
        }

        if (q.length > 7500) {
          failFallback();
        } else {
          fetch(q)
            .then(function (r) {
              netBlocked = false;
              return r.json();
            })
            .then(fin)
            .catch(failFallback);
        }
      });
    }

    // 11. المزامنة والتحقق من التضارب (Sync & Conflict Detection)
    function hasCloudDiff(d) {
      if (!d || !d.cfg || !d.cfg.url) return false;
      if (!cfg || !cfg.url) return true;

      var cRev = d.rev || (d.vals && d.vals._rev) || "";
      if (cRev && localRev && cRev !== localRev) {
        return true;
      }
      if (!cRev) {
        var ct = d.ts || 0;
        var lt = parseInt(store.get("sm_sync_ts") || "0", 10);
        if (ct > lt && (d.cfg.id !== cfg.id || JSON.stringify(d.cfg.fields) !== JSON.stringify(cfg.fields))) {
          return true;
        }
      }
      return false;
    }

    function applyCloudData(d) {
      if (!d) return false;
      if (d.cfg && d.cfg.url) cfg = normalizeCfg(d.cfg);

      if (d.vals && typeof d.vals === "object") {
        vals = d.vals;
        if (Array.isArray(vals._allowedSites)) {
          allowedSites = vals._allowedSites;
          if (!store.get("sm_def_removed") && allowedSites.indexOf(DEF_SITE) < 0) allowedSites.unshift(DEF_SITE);
        }
        if (vals.autoOpen === undefined) vals.autoOpen = false;
        if (!vals.openMode) vals.openMode = "tab";
      }

      // الاتفاق في جلسة الأسئلة: عند تنزيل السحابة يأخذ عداد السحابة بدقة
      var srvCount = (typeof d.count === "number") ? d.count : (d.vals && typeof d.vals._formCount === "number" ? d.vals._formCount : null);
      if (srvCount !== null) {
        formCount = srvCount;
        vals._formCount = formCount;
        store.set("sm_form_count", String(formCount));
      }

      var cRev = d.rev || (d.vals && d.vals._rev) || genRev();
      localRev = cRev;
      store.set("sm_rev", localRev);

      if (d.ts) store.set("sm_sync_ts", String(d.ts));
      persist(false);
      return true;
    }

    function pushCloud(cb) {
      if (!auth) {
        if (cb) cb(false, "not logged in");
        return;
      }
      persist(false);
      var ts = parseInt(store.get("sm_sync_ts") || "0", 10) || Date.now();
      store.set("sm_sync_ts", String(ts));

      apiCall("save", auth.user, auth.pass, {
        ts: ts,
        rev: localRev,
        count: formCount,
        cfg: cfg.url ? cfg : null,
        vals: netBlocked ? undefined : vals
      }, function (r) {
        var ok = Boolean(r && r.status === "ok");
        if (cb) cb(ok, ok ? (r.popup ? "popup" : "") : (r && r.msg || "Failed"));
      });
    }

    // فحص السحابة بالخلفية
    function bgCheckCloud(onResult) {
      if (!auth) {
        if (onResult) onResult(false, false, false);
        return;
      }

      apiCall("ping", auth.user, auth.pass, {
        rev: localRev,
        count: formCount,
        countResetTs: countResetTs,
        ts: parseInt(store.get("sm_sync_ts") || "0", 10) || 0
      }, function (r) {
        if (r && r.status === "ok") {
          if (r.upToDate === true) {
            if (onResult) onResult(true, false, false);
            return;
          }
          if (r.data && hasCloudDiff(r.data)) {
            pendingUpdate = r.data;
            if (onResult) onResult(true, false, true);
            return;
          }
          if (onResult) onResult(true, false, false);
          return;
        }

        // في حال فشل ping نجرب load
        apiCall("load", auth.user, auth.pass, null, function (r2) {
          if (r2 && r2.status === "ok" && r2.data) {
            if (hasCloudDiff(r2.data)) {
              pendingUpdate = r2.data;
              if (onResult) onResult(true, false, true);
              return;
            }
            if (onResult) onResult(true, false, false);
          } else {
            if (r2 && r2.msg === "Invalid session" && !auth.baked) {
              clearAuth();
            }
            if (onResult) onResult(false, false, false);
          }
        });
      });
    }

    // 12. محرك بناء عناصر واجهة المستخدم (DOM Builder Helper)
    function mk(tag, props, kids) {
      var el = document.createElement(tag);
      var after = null;
      if (props) {
        Object.keys(props).forEach(function (k) {
          var v = props[k];
          if (k === "style") el.style.cssText = v;
          else if (k === "className") el.className = v;
          else if (k === "text") el.textContent = v;
          else if (k === "onclick") el.onclick = v;
          else if (k === "value" || k === "checked") {
            after = after || {};
            after[k] = v;
          } else {
            el.setAttribute(k, v);
          }
        });
      }
      if (kids) {
        kids.forEach(function (c) {
          if (c) el.appendChild(c);
        });
      }
      if (after) {
        if ("value" in after) el.value = after.value;
        if ("checked" in after) el.checked = Boolean(after.checked);
      }
      return el;
    }

    var uiRefs = {};

    // 13. بناء واجهة المستخدم الكاملة (Catppuccin Macchiato Theme)
    function renderUI(customNotice) {
      var existing = document.getElementById(ID);
      if (existing) existing.remove();

      var rawPos = jp(store.get("sm_ui_pos"), null) || { top: "16px", left: "auto", right: "16px", width: "400px", height: "auto" };
      var vw = window.innerWidth || 1024;
      var boxW = Math.min(Math.max(parseInt(rawPos.width, 10) || 400, 355), vw - 20);

      var box = mk("div", {
        id: ID,
        style: "position:fixed;top:" + rawPos.top + ";left:" + rawPos.left + ";right:" + rawPos.right + ";width:" + boxW + "px;height:" + rawPos.height + ";min-width:355px;min-height:320px;max-width:95vw;max-height:92vh;background:#181825;color:#cdd6f4;border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.7);border:1px solid #313244;z-index:2147483647;font-family:system-ui,-apple-system,sans-serif;font-size:12px;direction:ltr;text-align:left;display:flex;flex-direction:column;resize:both;overflow:hidden;"
      });

      // CSS Stylesheet
      box.appendChild(mk("style", {
        text: "#sm_all_modal *{box-sizing:border-box;font-family:inherit;}#sm_all_modal select,#sm_all_modal input[type=text],#sm_all_modal input[type=password],#sm_all_modal input[type=number],#sm_all_modal input[type=date],#sm_all_modal input[type=time],#sm_all_modal textarea{display:block;width:100%;padding:8px;background:#11111b;color:#cdd6f4;border:1px solid #45475a;border-radius:6px;font-size:12px;outline:none;transition:border-color .2s;}#sm_all_modal select:focus,#sm_all_modal input:focus,#sm_all_modal textarea:focus{border-color:#89b4fa;}#sm_all_modal textarea{resize:vertical;min-height:42px;max-height:240px;}#sm_all_modal label.sm_lbl{display:block;font-size:11px;color:#a6adc8;margin-bottom:6px;font-weight:600;}#sm_all_modal .sm_row{margin-bottom:12px;}#sm_all_modal .sm_row:last-child{margin-bottom:0;}#sm_all_modal .sm_btn{padding:10px;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px;transition:opacity .15s;}#sm_all_modal .sm_btn:hover{opacity:.9;}#sm_all_modal .sm_btn:disabled{opacity:.5;cursor:not-allowed;}#sm_all_modal input[type=checkbox],#sm_all_modal input[type=radio]{-webkit-appearance:auto!important;appearance:auto!important;width:14px!important;height:14px!important;margin:0 4px 0 0!important;padding:0!important;display:inline-block!important;}#sm_all_modal .sm_scroll{scrollbar-width:thin;scrollbar-color:#45475a #181825;}#sm_all_modal ::-webkit-scrollbar{width:7px;height:7px;}#sm_all_modal ::-webkit-scrollbar-track{background:#181825;border-radius:4px;}#sm_all_modal ::-webkit-scrollbar-thumb{background:#45475a;border-radius:4px;}#sm_all_modal ::-webkit-scrollbar-thumb:hover{background:#89b4fa;}#sm_all_modal .sm_rz{position:absolute;bottom:0;right:0;width:0;height:0;border-style:solid;border-width:0 0 14px 14px;border-color:transparent transparent #89b4fa transparent;pointer-events:none;}"
      }));

      // Header Elements
      var syncEl = mk("span", {
        style: "font-size:10px;color:#a6adc8;font-weight:500;margin-left:6px;",
        text: auth ? "⚡ Ready " + (localRev ? "(#" + localRev + ")" : "") : "⚡ Local only"
      });

      var countEl = mk("span", {
        style: "color:#a6e3a1;font-weight:700;font-size:11px;cursor:pointer;",
        text: "📊 Forms: " + formCount,
        title: "Click to edit number"
      });

      var countReset = mk("button", {
        style: "background:#313244;border:none;color:#f38ba8;border-radius:4px;cursor:pointer;font-size:10px;padding:2px 5px;font-weight:700;",
        text: "↺",
        title: "Reset Counter"
      });

      var counterBadge = mk("div", {
        style: "display:flex;align-items:center;gap:5px;background:#181825;padding:3px 8px;border-radius:6px;border:1px solid #313244;margin-right:8px;"
      }, [countEl, countReset]);

      // تعديل العداد بالنقر المباشر
      countEl.onclick = function () {
        countEl.style.display = "none";
        countReset.style.display = "none";
        var inp = mk("input", {
          type: "number",
          value: formCount,
          style: "width:45px;height:18px;font-size:10px;padding:0 2px;background:#11111b;color:#a6e3a1;border:1px solid #45475a;border-radius:3px;outline:none;"
        });
        var okB = mk("button", { text: "✔", style: "background:#a6e3a1;color:#11111b;border:none;border-radius:3px;padding:0 4px;cursor:pointer;font-weight:bold;" });
        var cxB = mk("button", { text: "✕", style: "background:#f38ba8;color:#11111b;border:none;border-radius:3px;padding:0 4px;cursor:pointer;font-weight:bold;" });
        var w = mk("div", { style: "display:flex;align-items:center;gap:4px;" }, [inp, okB, cxB]);

        counterBadge.insertBefore(w, countReset);
        inp.focus();

        function cls() {
          w.remove();
          countEl.textContent = "📊 Forms: " + formCount;
          countEl.style.display = "inline";
          countReset.style.display = "inline";
        }

        okB.onclick = function () {
          var nv = parseInt(inp.value, 10);
          if (!isNaN(nv) && nv >= 0) {
            formCount = nv;
            countResetTs = Date.now();
            persist(false);
            if (auth) pushCloud();
          }
          cls();
        };
        cxB.onclick = cls;
      };

      // تصفير العداد بزر ↺
      countReset.onclick = function () {
        countEl.style.display = "none";
        countReset.style.display = "none";
        var msg = mk("span", { style: "color:#f38ba8;font-weight:700;font-size:10px;", text: "Reset?" });
        var yB = mk("button", { text: "Yes", style: "background:#f38ba8;color:#11111b;border:none;border-radius:3px;padding:0 4px;cursor:pointer;font-weight:700;" });
        var nB = mk("button", { text: "No", style: "background:#45475a;color:#cdd6f4;border:none;border-radius:3px;padding:0 4px;cursor:pointer;font-weight:700;" });
        var w = mk("div", { style: "display:flex;align-items:center;gap:4px;" }, [msg, yB, nB]);

        counterBadge.appendChild(w);

        function cls() {
          w.remove();
          countEl.textContent = "📊 Forms: " + formCount;
          countEl.style.display = "inline";
          countReset.style.display = "inline";
        }

        yB.onclick = function () {
          formCount = 0;
          countResetTs = Date.now();
          persist(false);
          if (auth) pushCloud();
          cls();
        };
        nB.onclick = cls;
      };

      var closeX = mk("button", {
        style: "background:none;border:none;color:#a6adc8;cursor:pointer;font-size:16px;padding:0;line-height:1;",
        text: "✕"
      });

      var hdr = mk("div", {
        style: "background:#11111b;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;cursor:move;border-bottom:1px solid #313244;user-select:none;flex-shrink:0;"
      }, [
        mk("div", { style: "display:flex;align-items:center;" }, [
          mk("span", { style: "font-weight:700;color:#89b4fa;font-size:14px;", text: isForm ? "⚡ Form Setup" : "⚡ Runner" }),
          syncEl
        ]),
        mk("div", { style: "display:flex;align-items:center;gap:8px;" }, [counterBadge, closeX])
      ]);

      function clampModal() {
        var r = box.getBoundingClientRect();
        var w = window.innerWidth || 1024;
        var h = window.innerHeight || 768;
        if (r.right > w || r.left < 0) {
          box.style.left = Math.max(4, Math.min(w - r.width - 4, r.left)) + "px";
          box.style.right = "auto";
        }
        if (r.bottom > h || r.top < 0) {
          box.style.top = Math.max(4, Math.min(h - 60, r.top)) + "px";
        }
      }

      function savePos() {
        store.set("sm_ui_pos", JSON.stringify({
          top: box.style.top,
          left: box.style.left,
          right: box.style.right,
          width: box.style.width,
          height: box.style.height
        }));
      }

      // تحريك وسحب النافذة
      var down = false, ox = 0, oy = 0;
      hdr.onmousedown = function (e) {
        if (e.target.tagName === "BUTTON" || e.target.tagName === "INPUT") return;
        down = true;
        var r = box.getBoundingClientRect();
        ox = e.clientX - r.left;
        oy = e.clientY - r.top;
        document.onmousemove = function (ev) {
          if (!down) return;
          box.style.left = Math.max(0, Math.min(window.innerWidth - r.width, ev.clientX - ox)) + "px";
          box.style.top = Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - oy)) + "px";
          box.style.right = "auto";
        };
        document.onmouseup = function () {
          down = false;
          document.onmousemove = null;
          document.onmouseup = null;
          savePos();
        };
      };

      try {
        new ResizeObserver(savePos).observe(box);
      } catch (e) { }

      var content = mk("div", { className: "sm_scroll", style: "padding:14px;flex:1;overflow-y:auto;overflow-x:hidden;" });
      var footer = mk("div", { style: "display:none;padding:7px 12px;background:#11111b;font-size:11px;font-weight:600;border-top:1px solid #313244;text-align:center;" });

      function say(msg, col, autoHide) {
        footer.textContent = msg;
        footer.style.color = col || "#f38ba8";
        footer.style.display = "block";
        if (autoHide) {
          setTimeout(function () {
            if (footer.textContent === msg) footer.style.display = "none";
          }, 3500);
        }
      }

      if (customNotice) say(customNotice, "#f9e2af", false);

      var inputs = {};

      function build() {
        content.textContent = "";
        inputs = {};

        var hasForm = Boolean(cfg && cfg.url && Array.isArray(cfg.fields) && cfg.fields.length > 0);
        var diffForm = Boolean(isForm && pageCfg && hasForm && (cfg.id !== pageCfg.id || cfg.url !== pageCfg.url));
        var unlinked = Boolean(isForm && pageCfg && !hasForm);

        // 14. بانر التعارض والتحديث السحابي (Conflict Resolution Banner)
        if (pendingUpdate) {
          var upRev = pendingUpdate.rev || (pendingUpdate.vals && pendingUpdate.vals._rev) || "new";
          var upTitle = (pendingUpdate.cfg && pendingUpdate.cfg.title) ? pendingUpdate.cfg.title : "Form Settings";
          var upCount = (typeof pendingUpdate.count === "number") ? pendingUpdate.count : (pendingUpdate.vals && typeof pendingUpdate.vals._formCount === "number" ? pendingUpdate.vals._formCount : formCount);

          var upBar = mk("div", {
            style: "background:#1e1e2e;border:1px solid #f9e2af;border-left:4px solid #f9e2af;padding:10px 12px;border-radius:8px;margin-bottom:12px;"
          }, [
            mk("div", { style: "color:#f9e2af;font-weight:700;font-size:11px;margin-bottom:6px;", text: "🔔 Cloud Update Available (#" + upRev + " - " + upTitle + ")" }),
            mk("div", { style: "color:#cdd6f4;font-size:10px;margin-bottom:8px;", text: "Cloud has a different revision or newer form. Download cloud data or upload local?" }),
            mk("div", { style: "display:flex;gap:6px;" }, [
              // زر تنزيل السحابة
              mk("button", {
                style: "flex:1;background:#a6e3a1;color:#11111b;border:none;border-radius:4px;padding:6px;font-size:11px;font-weight:700;cursor:pointer;",
                text: "⬇️ Apply Cloud",
                title: "Download and use cloud form and count (" + upCount + ")",
                onclick: function () {
                  applyCloudData(pendingUpdate);
                  pendingUpdate = null;
                  countEl.textContent = "📊 Forms: " + formCount;
                  syncEl.textContent = "✔ Updated (#" + localRev + ")";
                  build();
                  say("✔ Cloud update applied!", "#a6e3a1", true);
                }
              }),
              // زر رفع النسخة المحلية
              mk("button", {
                style: "flex:1;background:#89b4fa;color:#11111b;border:none;border-radius:4px;padding:6px;font-size:11px;font-weight:700;cursor:pointer;",
                text: "⬆️ Keep Local",
                title: "Upload your current local data and count to cloud",
                onclick: function () {
                  pendingUpdate = null;
                  persist(true);
                  if (auth) {
                    pushCloud(function (ok) {
                      if (ok) say("✔ Local version uploaded to cloud!", "#a6e3a1", true);
                    });
                  }
                  syncEl.textContent = "✔ Synced (#" + localRev + ")";
                  build();
                }
              }),
              // زر الإلغاء
              mk("button", {
                style: "background:#313244;color:#cdd6f4;border:1px solid #45475a;border-radius:4px;padding:6px 10px;font-size:11px;font-weight:600;cursor:pointer;",
                text: "✕",
                onclick: function () {
                  pendingUpdate = null;
                  build();
                }
              })
            ])
          ]);
          content.appendChild(upBar);
        }

        // Target Form Information Banner
        var cur = hasForm ? cfg : emptyCfg();
        content.appendChild(mk("div", {
          style: "background:#11111b;padding:12px;border-radius:8px;margin-bottom:10px;border:1px solid #45475a;font-size:11px;"
        }, [
          mk("div", { style: "color:#a6e3a1;font-weight:700;margin-bottom:6px;font-size:12px;", text: "Target Form: " + (cur.title || "No Form Linked") }),
          mk("div", { style: "color:#f9e2af;margin-bottom:6px;word-break:break-all;padding:4px 6px;background:#181825;border-radius:4px;border:1px solid #313244;", text: "ID: " + (cur.id || "---") + (localRev ? "  |  Rev: #" + localRev : "") }),
          mk("div", { style: "color:#a6adc8;font-size:10px;word-break:break-all;", text: "URL: " + (cur.url || "Please link a form first.") })
        ]));

        // Auth Section
        var ab = mk("div", { style: "background:#11111b;padding:10px 12px;border-radius:8px;margin-bottom:10px;border:1px solid #313244;" });
        if (auth) {
          var bt = mk("button", {
            style: "background:#313244;border:1px solid #a6e3a1;color:#a6e3a1;border-radius:4px;padding:4px 8px;font-size:10px;font-weight:700;cursor:pointer;",
            text: "📌 Portable",
            title: "Copies a self-contained bookmarklet with your login inside"
          });

          bt.onclick = function () {
            var cr = JSON.stringify(auth.pass ? { user: auth.user, pass: auth.pass } : { user: auth.user, token: auth.token })
              .replace(/\x25/g, "\\u0025")
              .replace(/</g, "\\u003c");

            var fnBody = M.toString();
            var portCode = "javascript:(function M(BAKED){" + fnBody.match(/\{([\s\S]*)\}/)[1] + "})(" + cr + ");";

            copyText(portCode, function (ok) {
              bt.textContent = ok ? "✔ Copied!" : "❌ Failed";
              setTimeout(function () { bt.textContent = "📌 Portable"; }, 3000);
            });
          };

          var sb = mk("button", {
            style: "background:#313244;border:1px solid #45475a;color:#89b4fa;border-radius:4px;padding:4px 8px;font-size:10px;font-weight:700;cursor:pointer;",
            text: "☁️ Sync"
          });

          sb.onclick = function () {
            if (sb.disabled) return;
            sb.disabled = true;
            sb.textContent = "⏳...";
            apiCall("load", auth.user, auth.pass, null, function (r) {
              sb.disabled = false;
              sb.textContent = "☁️ Sync";
              if (r && r.status === "ok" && r.data) {
                applyCloudData(r.data);
                pendingUpdate = null;
                countEl.textContent = "📊 Forms: " + formCount;
                syncEl.textContent = "✔ Synced (#" + localRev + ")";
                build();
                say("✔ Synced from cloud!", "#a6e3a1", true);
              } else {
                say("⚠️ Sync failed: " + (r && r.msg || "Error"), "#f38ba8", true);
              }
            });
          };

          var sw = mk("button", {
            style: "background:#313244;border:1px solid #f38ba8;color:#f38ba8;border-radius:4px;padding:4px 8px;font-size:10px;font-weight:700;cursor:pointer;",
            text: "🔄 Switch"
          });

          sw.onclick = function () {
            if (sw.dataset.c === "1") {
              clearAuth();
              ["sm_form_cfg", "sm_form_vals", "sm_form_count", "sm_sync_ts", "sm_rev"].forEach(function (k) {
                store.rm(k);
              });
              cfg = emptyCfg();
              formCount = 0;
              localRev = "";
              vals = { autoOpen: false, openMode: "tab", _formCount: 0 };
              pendingUpdate = null;
              syncEl.textContent = "⚡ Local only";
              countEl.textContent = "📊 Forms: 0";
              build();
            } else {
              sw.dataset.c = "1";
              sw.textContent = "Logout?";
              setTimeout(function () {
                if (sw) {
                  sw.dataset.c = "0";
                  sw.textContent = "🔄 Switch";
                }
              }, 2500);
            }
          };

          ab.appendChild(mk("div", { style: "display:flex;justify-content:space-between;align-items:center;gap:6px;" }, [
            mk("div", { style: "display:flex;align-items:center;gap:4px;overflow:hidden;" }, [
              mk("span", { text: "👤" }),
              mk("strong", { style: "font-size:12px;color:#cba6f7;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;", text: auth.user })
            ]),
            mk("div", { style: "display:flex;gap:5px;flex-shrink:0;" }, [bt, sb, sw])
          ]));
        } else {
          ab.style.borderColor = "#cba6f7";
          var ui = mk("input", { type: "text", placeholder: "Username", style: "margin-bottom:6px;" });
          var pi = mk("input", { type: "password", placeholder: "Password", style: "margin-bottom:8px;" });
          var am = mk("div", { style: "font-size:10px;font-weight:600;margin-bottom:6px;display:none;" });

          function amsg(t, c) {
            am.textContent = t;
            am.style.color = c || "#f38ba8";
            am.style.display = "block";
          }

          var authBusy = false;
          function doAuth(mode) {
            if (authBusy) return;
            var u = ui.value.trim().toLowerCase().replace(/[^a-z0-9_@.-]/g, "");
            var p = pi.value;
            if (!u || !p) return amsg("⚠️ Enter username and password.", "#f9e2af");

            authBusy = true;
            amsg(mode === "login" ? "⏳ Logging in..." : "⏳ Registering...", "#89b4fa");

            var extra = mode === "register" ? {
              ts: Date.now(),
              rev: localRev || genRev(),
              count: formCount,
              cfg: hasForm ? cfg : null,
              vals: vals
            } : null;

            apiCall(mode, u, p, extra, function (r) {
              authBusy = false;
              if (r && r.status === "ok") {
                auth = { user: u, pass: p, token: r.token };
                saveAuth();
                if (r.data && (r.data.cfg || r.data.vals)) {
                  applyCloudData(r.data);
                } else if (hasForm) {
                  pushCloud();
                }
                countEl.textContent = "📊 Forms: " + formCount;
                syncEl.textContent = "✔ Synced (#" + localRev + ")";
                build();
              } else {
                amsg("❌ " + (r && r.msg || "Failed"), "#f38ba8");
              }
            });
          }

          ab.appendChild(mk("div", { style: "color:#cba6f7;font-weight:700;font-size:11px;margin-bottom:6px;", text: "🔐 Login / Register" }));
          ab.appendChild(ui);
          ab.appendChild(pi);
          ab.appendChild(am);
          ab.appendChild(mk("div", { style: "display:flex;gap:6px;" }, [
            mk("button", {
              style: "flex:1;background:#89b4fa;color:#11111b;border:none;border-radius:4px;padding:6px;font-size:11px;font-weight:700;cursor:pointer;",
              text: "🔑 Login",
              onclick: function () { doAuth("login"); }
            }),
            mk("button", {
              style: "flex:1;background:#cba6f7;color:#11111b;border:none;border-radius:4px;padding:6px;font-size:11px;font-weight:700;cursor:pointer;",
              text: "✨ Register",
              onclick: function () { doAuth("register"); }
            })
          ]));
        }
        content.appendChild(ab);

        // Relink / Change Form Banner
        var bn = mk("div", { style: "background:#11111b;padding:10px 12px;border-radius:8px;margin-bottom:14px;border:1px solid #313244;font-size:11px;" });

        function applyNewFormLink(clearOld) {
          if (!pageCfg) return;
          cfg = normalizeCfg(JSON.parse(JSON.stringify(pageCfg)));
          if (clearOld) {
            vals = {
              autoOpen: Boolean(vals.autoOpen),
              openMode: vals.openMode || "tab",
              _formCount: formCount,
              _countResetTs: countResetTs,
              _allowedSites: allowedSites
            };
            if (detEmail) vals.email = detEmail;
          }
          pendingUpdate = null;
          store.set("sm_sync_ts", String(Date.now() + 5000));
          persist(true);
          if (auth) pushCloud();
          syncEl.textContent = "✔ Linked (#" + localRev + ")";
          build();
          say("✔ New form linked & old data cleared!", "#a6e3a1", true);
        }

        function showRelinkConfirm(promptText, btnLabel, borderColor) {
          bn.textContent = "";
          bn.style.borderColor = borderColor;
          var mainRow = mk("div", { style: "display:flex;justify-content:space-between;align-items:center;gap:8px;" }, [
            mk("span", { style: "color:" + borderColor + ";font-weight:700;", text: promptText }),
            mk("button", {
              style: "background:" + borderColor + ";color:#11111b;border:none;border-radius:4px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;",
              text: btnLabel,
              onclick: function () {
                bn.textContent = "";
                bn.style.borderColor = "#f9e2af";
                bn.appendChild(mk("div", { style: "color:#f9e2af;font-weight:700;margin-bottom:8px;font-size:11px;", text: "⚠️ Replace form and clear old data?" }));
                bn.appendChild(mk("div", { style: "display:flex;gap:6px;" }, [
                  mk("button", {
                    style: "flex:1;background:#a6e3a1;color:#11111b;border:none;border-radius:4px;padding:6px;font-size:11px;font-weight:700;cursor:pointer;",
                    text: "✔ Yes, Replace",
                    onclick: function () { applyNewFormLink(true); }
                  }),
                  mk("button", {
                    style: "flex:1;background:#313244;color:#cdd6f4;border:1px solid #45475a;border-radius:4px;padding:6px;font-size:11px;font-weight:600;cursor:pointer;",
                    text: "✕ Cancel",
                    onclick: function () { build(); }
                  })
                ]));
              }
            })
          ]);
          bn.appendChild(mainRow);
        }

        if (diffForm) {
          showRelinkConfirm("This page is a different form", "🔄 Update to this form", "#f9e2af");
          content.appendChild(bn);
        } else if (unlinked) {
          bn.style.borderColor = "#f38ba8";
          bn.appendChild(mk("div", { style: "display:flex;justify-content:space-between;align-items:center;gap:8px;" }, [
            mk("span", { style: "color:#f38ba8;font-weight:700;", text: "Form not linked yet" }),
            mk("button", {
              style: "background:#a6e3a1;color:#11111b;border:none;border-radius:4px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;",
              text: "🔗 Link this form",
              onclick: function () { applyNewFormLink(true); }
            })
          ]));
          content.appendChild(bn);
        }

        // Form Fields Box
        if (hasForm) {
          var fBox = mk("div", { style: "background:#11111b;padding:12px;border-radius:8px;border:1px solid #313244;margin-bottom:14px;" });

          cfg.fields.forEach(function (f) {
            var sk = Object.keys(cfg.mapping).filter(function (k) { return cfg.mapping[k] === f.id; })[0];
            var val = sk ? (vals[sk] || vals[f.id] || "") : (vals[f.id] || "");
            var isEnv = false;

            if (isGulp && !isForm) {
              if (sk === "gulp" && autoGulp) { val = autoGulp; isEnv = true; }
              else if (sk === "webviz" && autoWebviz) { val = autoWebviz; isEnv = true; }
              else if (sk === "roadEvent" && autoSeg) { val = autoSeg; isEnv = true; }
            }

            var el;
            var opts = Array.isArray(f.options) ? f.options : [];
            if (f.type === 13) {
              el = mk("div", {
                style: "font-size:10px;color:#f9e2af;padding:6px;background:#181825;border:1px solid #313244;border-radius:4px;",
                text: "📎 File uploads must be done manually in the form."
              });
            } else if (opts.length > 0) {
              el = mk("select", {}, [mk("option", { value: "", text: "-- Select --" })].concat(opts.map(function (o) {
                return mk("option", { value: o, text: o });
              })));
              el.value = val;
            } else if (f.type === 1) {
              el = mk("textarea", { rows: "3", value: val });
            } else if (f.type === 9) {
              el = mk("input", { type: "date", value: val });
            } else if (f.type === 10) {
              el = mk("input", { type: "time", value: val });
            } else {
              el = mk("input", { type: "text", value: val });
            }

            inputs[f.id] = el;
            var row = mk("div", { className: "sm_row" }, [
              mk("label", { className: "sm_lbl", text: f.label })
            ]);

            if (isEnv) {
              row.appendChild(mk("span", {
                style: "color:#a6e3a1;font-size:10px;font-weight:bold;display:block;margin-bottom:4px;",
                text: "✔️ Auto-filled from environment"
              }));
              el.style.display = "none";
            }
            row.appendChild(el);
            fBox.appendChild(row);
          });

          var miss = [["gulp", "Gulp Link"], ["webviz", "Webviz Link"], ["roadEvent", "Segment ID"]].filter(function (x) {
            return !cfg.mapping[x[0]];
          }).map(function (x) { return x[1]; });

          if (miss.length) {
            fBox.appendChild(mk("div", {
              style: "background:#181825;border-left:3px solid #f38ba8;padding:6px 10px;margin-top:10px;font-size:10px;color:#a6adc8;"
            }, [
              mk("strong", { style: "color:#f38ba8;display:block;margin-bottom:2px;", text: "Not available in this form:" }),
              mk("span", { text: miss.join(", ") })
            ]));
          }
          content.appendChild(fBox);
        }

        // Auto-Open & Allowed Sites Settings
        var cbAuto = mk("input", { type: "checkbox", checked: Boolean(vals.autoOpen) });
        var rTab = mk("input", { type: "radio", name: "sm_mode", checked: vals.openMode !== "window" });
        var rWin = mk("input", { type: "radio", name: "sm_mode", checked: vals.openMode === "window" });
        var sPanel = mk("div", { style: "display:none;background:#181825;padding:10px;border-radius:6px;border:1px solid #45475a;margin-top:10px;" });

        function cleanDomain(str) {
          return String(str || "").trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0].split("?")[0].replace(/[^a-z0-9.-]/g, "");
        }

        function renderSites() {
          sPanel.textContent = "";
          sPanel.appendChild(mk("div", { style: "color:#a6e3a1;font-weight:600;margin-bottom:8px;font-size:11px;", text: "Sites that can Auto-Open Form:" }));
          var listWrap = mk("div", { className: "sm_scroll", style: "max-height:110px;overflow-y:auto;margin-bottom:8px;" });

          allowedSites.forEach(function (s, idx) {
            var sRow = mk("div", {
              style: "display:flex;justify-content:space-between;align-items:center;background:#11111b;padding:4px 8px;border-radius:4px;margin-bottom:4px;border:1px solid #313244;font-size:11px;"
            });
            sRow.appendChild(mk("span", { text: s, style: "color:#cdd6f4;" }));

            var rCol = mk("div", { style: "display:flex;align-items:center;gap:6px;" });
            if (s === DEF_SITE) rCol.appendChild(mk("span", { style: "color:#6c7086;font-size:9px;", text: "(Default)" }));

            var delB = mk("button", {
              style: "background:none;border:none;color:#f38ba8;cursor:pointer;font-size:12px;padding:0 4px;",
              text: "✕",
              onclick: function () {
                if (sRow.querySelector(".sm_w")) return;
                delB.style.display = "none";
                var w = mk("div", { className: "sm_w", style: "display:flex;gap:4px;align-items:center;" }, [
                  mk("span", { style: "color:#f38ba8;font-size:10px;", text: "Remove?" }),
                  mk("button", {
                    style: "background:#f38ba8;color:#11111b;border:none;border-radius:3px;font-size:10px;padding:2px 5px;cursor:pointer;font-weight:700;",
                    text: "Yes",
                    onclick: function () {
                      if (s === DEF_SITE) store.set("sm_def_removed", "1");
                      allowedSites.splice(idx, 1);
                      persist(true);
                      renderSites();
                    }
                  }),
                  mk("button", {
                    style: "background:#45475a;color:#cdd6f4;border:none;border-radius:3px;font-size:10px;padding:2px 5px;cursor:pointer;",
                    text: "No",
                    onclick: function () {
                      w.remove();
                      delB.style.display = "inline-block";
                    }
                  })
                ]);
                rCol.appendChild(w);
              }
            });

            rCol.appendChild(delB);
            sRow.appendChild(rCol);
            listWrap.appendChild(sRow);
          });

          sPanel.appendChild(listWrap);

          var dIn = mk("input", { type: "text", placeholder: "Add domain (e.g. site.com)", style: "flex:1;padding:5px 8px;font-size:11px;" });
          sPanel.appendChild(mk("div", { style: "display:flex;gap:6px;" }, [
            dIn,
            mk("button", {
              style: "background:#89b4fa;color:#11111b;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-weight:700;font-size:11px;",
              text: "Add",
              onclick: function () {
                var dom = cleanDomain(dIn.value);
                if (dom && dom.indexOf(".") > -1 && allowedSites.indexOf(dom) < 0) {
                  if (dom === DEF_SITE) store.rm("sm_def_removed");
                  allowedSites.push(dom);
                  persist(true);
                  renderSites();
                }
              }
            })
          ]));
        }

        renderSites();

        var mBtn = mk("button", {
          style: "background:#313244;border:1px solid #45475a;color:#cdd6f4;border-radius:6px;cursor:pointer;font-size:11px;padding:6px 10px;font-weight:600;",
          text: "🌐 Manage Auto-Open Sites",
          onclick: function () {
            sPanel.style.display = sPanel.style.display === "none" ? "block" : "none";
          }
        });

        content.appendChild(mk("div", { style: "background:#11111b;padding:12px;border-radius:8px;border:1px solid #313244;" }, [
          mk("label", { style: "display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:#a6e3a1;margin-bottom:8px;font-weight:600;" }, [
            cbAuto,
            mk("span", { text: "Auto-Open (Double-click bookmark to edit)" })
          ]),
          mk("div", { style: "display:flex;align-items:center;gap:15px;font-size:11px;margin-bottom:12px;" }, [
            mk("span", { style: "color:#a6adc8;", text: "Open in:" }),
            mk("label", { style: "display:flex;align-items:center;gap:4px;cursor:pointer;" }, [
              rTab,
              mk("span", { text: "New Tab" })
            ]),
            mk("label", { style: "display:flex;align-items:center;gap:4px;cursor:pointer;" }, [
              rWin,
              mk("span", { text: "Popup" })
            ])
          ]),
          mBtn,
          sPanel
        ]));

        box._read = function () {
          vals.autoOpen = cbAuto.checked;
          vals.openMode = rWin.checked ? "window" : "tab";
          if (hasForm) {
            cfg.fields.forEach(function (f) {
              var sk = Object.keys(cfg.mapping).filter(function (k) { return cfg.mapping[k] === f.id; })[0];
              if (inputs[f.id] && f.type !== 13) {
                var v = inputs[f.id].value;
                if (sk) vals[sk] = v;
                vals[f.id] = v;
              }
            });
          }
        };
      }

      build();

      // Footer Action Buttons
      var bRow = mk("div", {
        style: "display:flex;gap:6px;padding:12px;border-top:1px solid #313244;background:#181825;flex-shrink:0;"
      });

      function readAndSave(bump) {
        if (box._read) box._read();
        if (!cfg.url && isForm && pageCfg) cfg = normalizeCfg(pageCfg);
        persist(bump);
      }

      var openBtn = mk("button", {
        className: "sm_btn",
        style: "flex:1.4;background:#a6e3a1;color:#11111b;",
        text: "🚀 Open Now",
        onclick: function () {
          if (openBtn.disabled) return;
          readAndSave(false);
          if (!cfg || !cfg.url || !cfg.fields.length) {
            say("⚠️ Please link a form first before opening!", "#f38ba8", true);
            return;
          }
          openBtn.disabled = true;
          formCount++;
          persist(false);
          var opened = openForm(vals);
          if (auth) pushCloud();
          if (opened) {
            box.remove();
          } else {
            openBtn.disabled = false;
            say("⚠️ Popup blocked by browser! Please allow popups for this site.", "#f9e2af", false);
          }
        }
      });
      bRow.appendChild(openBtn);

      var saveBtn = mk("button", {
        className: "sm_btn",
        style: "flex:1.4;background:#89b4fa;color:#11111b;",
        text: auth ? "💾 Save & Sync" : "💾 Save Locally"
      });

      saveBtn.onclick = function () {
        if (saveBtn.disabled) return;
        readAndSave(true);
        syncEl.textContent = "⚡ Ready (#" + localRev + ")";

        if (!auth) {
          saveBtn.textContent = "✔ Saved Locally!";
          saveBtn.style.background = "#a6e3a1";
          setTimeout(function () { box.remove(); }, 500);
          return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = "⏳ Syncing...";
        pushCloud(function (ok, msg) {
          saveBtn.disabled = false;
          if (ok) {
            saveBtn.textContent = (msg === "popup") ? "✔ Sent via popup" : "✔ Saved & Synced!";
            saveBtn.style.background = "#a6e3a1";
            setTimeout(function () { box.remove(); }, 500);
          } else {
            saveBtn.textContent = "💾 Save & Sync";
            say("⚠️ Saved locally (#" + localRev + "), cloud sync failed: " + msg, "#f9e2af", false);
          }
        });
      };
      bRow.appendChild(saveBtn);

      var rstBtn = mk("button", {
        className: "sm_btn",
        style: "flex:.8;background:#f38ba8;color:#11111b;",
        text: "🗑️ Reset"
      });

      rstBtn.onclick = function () {
        if (rstBtn.dataset.c === "1") {
          ["sm_form_cfg", "sm_form_vals", "sm_allowed_sites", "sm_ui_pos", "sm_last_run", "sm_sync_ts", "sm_form_count", "sm_rev", "sm_def_removed", "sm_count_reset_ts"].forEach(function (k) {
            store.rm(k);
          });
          clearAuth();
          formCount = 0;
          countResetTs = 0;
          localRev = "";
          cfg = emptyCfg();
          vals = { autoOpen: false, openMode: "tab", _formCount: 0 };
          allowedSites = [DEF_SITE];
          pendingUpdate = null;
          syncEl.textContent = "⚡ Local only";
          countEl.textContent = "📊 Forms: 0";
          build();
          say("✔ All local data reset!", "#a6e3a1", true);
        } else {
          rstBtn.dataset.c = "1";
          rstBtn.textContent = "Sure?";
          setTimeout(function () {
            if (rstBtn) {
              rstBtn.dataset.c = "0";
              rstBtn.textContent = "🗑️ Reset";
            }
          }, 3000);
        }
      };
      bRow.appendChild(rstBtn);

      bRow.appendChild(mk("button", {
        className: "sm_btn",
        style: "background:#313244;color:#cdd6f4;flex:.8;",
        text: "Close",
        onclick: function () { box.remove(); }
      }));

      closeX.onclick = function () { box.remove(); };

      [hdr, content, footer, bRow, mk("div", { className: "sm_rz" })].forEach(function (el) {
        box.appendChild(el);
      });

      document.body.appendChild(box);
      clampModal();

      uiRefs = {
        box: box,
        countEl: countEl,
        syncEl: syncEl,
        build: build
      };
    }

    // 15. دورة حياة التنفيذ (Fast Run vs Cold Start)
    var hasSavedLocal = Boolean(cfg && cfg.url && Array.isArray(cfg.fields) && cfg.fields.length > 0);
    var onAllowedSite = allowedSites.some(function (s) { return location.host.indexOf(s) > -1; });

    // السيناريو أ: توجد داتا محلية أو نحن في صفحة فورم
    if (hasSavedLocal || isForm) {
      if (!isForm && onAllowedSite && vals.autoOpen && !hasSel && !isDbl && cfg.url) {
        // الفتح التلقائي الفوري (0ms)
        formCount++;
        persist(false);
        var okOpen = openForm(vals);
        if (!okOpen) {
          renderUI("⚠️ Browser blocked the automatic popup! Click '🚀 Open Now' below.");
        }

        // فحص السحابة بالخلفية: إذا وجد تحديث يفتح نافذة البوكمارك فوراً لتنبيهك!
        if (auth) {
          bgCheckCloud(function (ok, cntCh, hasUp) {
            if (hasUp) {
              renderUI();
            } else if (ok) {
              pushCloud();
            }
          });
        }
        return;
      }

      // إذا لم يكن Auto-Open: افتح الواجهة فوراً
      renderUI();

      if (auth) {
        uiRefs.syncEl.textContent = "☁️ Checking #" + (localRev || "...") + "...";
        bgCheckCloud(function (ok, cntCh, hasUp) {
          if (!document.getElementById(ID)) {
            // لو النافذة قُفلت ووُجد تحديث: افتحها فوراً كما طلبت
            if (hasUp) renderUI();
            return;
          }
          if (cntCh && uiRefs.countEl) {
            uiRefs.countEl.textContent = "📊 Forms: " + formCount;
          }
          if (hasUp && uiRefs.build) {
            uiRefs.syncEl.textContent = "🔔 Update found!";
            uiRefs.build();
          } else if (ok) {
            uiRefs.syncEl.textContent = "✔ Up to date (#" + (localRev || "ok") + ")";
          }
        });
      }
      return;
    }

    // السيناريو ب: تشغيل على البارد (Cold Start on New Site - لا توجد داتا محلية)
    var loadBox = (function () {
      var rawPos = jp(store.get("sm_ui_pos"), null) || { top: "16px", left: "auto", right: "16px", width: "395px", height: "auto" };
      var box = mk("div", {
        id: ID,
        style: "position:fixed;top:" + rawPos.top + ";left:" + rawPos.left + ";right:" + rawPos.right + ";width:" + boxW + "px;height:160px;min-width:355px;background:#181825;color:#cdd6f4;border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.7);border:1px solid #313244;z-index:2147483647;font-family:system-ui,-apple-system,sans-serif;font-size:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;"
      });
      var spinner = mk("div", {
        style: "width:28px;height:28px;border:3px solid #45475a;border-top:3px solid #89b4fa;border-radius:50%;animation:sm_spin .8s linear infinite;margin-bottom:10px;"
      });
      var spinStyle = mk("style", {
        text: "@keyframes sm_spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}"
      });
      var text = mk("div", {
        style: "color:#a6adc8;font-weight:600;font-size:12px;",
        text: "⏳ Checking cloud profile..."
      });
      box.appendChild(spinStyle);
      box.appendChild(spinner);
      box.appendChild(text);
      document.body.appendChild(box);
      return box;
    })();

    var doneInit = false;
    function finishInit(loaded) {
      if (doneInit) return;
      doneInit = true;
      if (loadBox) loadBox.remove();

      // الاتفاق في جلسة الأسئلة: إذا نجح السحب وAuto-Open مفعل والموقع مصرح: يفتح فوراً
      if (loaded && !isForm && onAllowedSite && vals.autoOpen && !hasSel && !isDbl && cfg.url) {
        formCount++;
        persist(false);
        if (!openForm(vals)) {
          renderUI("⚠️ Popup blocked! Click '🚀 Open Now' below.");
        } else if (auth) {
          pushCloud();
        }
        return;
      }
      renderUI();
    }

    setTimeout(function () { finishInit(false); }, 4000);

    if (auth) {
      apiCall("load", auth.user, auth.pass, null, function (r) {
        var ok = Boolean(r && r.status === "ok" && r.data && applyCloudData(r.data));
        finishInit(ok);
      });
    } else {
      apiCall("probe", "", "", null, function (r) {
        var ok = false;
        if (r && r.status === "ok" && r.user && (r.token || r.pass)) {
          auth = { user: r.user, token: r.token, pass: r.pass };
          saveAuth();
          if (r.data) ok = applyCloudData(r.data);
        }
        finishInit(ok);
      });
    }

  } catch (err) {
    var mEl = document.getElementById(ID);
    if (mEl) mEl.remove();
    alert("Runner Error: " + err.message);
  }
})(typeof BAKED !== "undefined" ? BAKED : null);
