function hashPwd(pwd) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pwd) + "_sm_salt_2026");
  return raw.map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

function makeToken(user, passHash) {
  return hashPwd(user + ":" + passHash + ":token_v2");
}

function handleRequest(params, bodyStr) {
  var prop = PropertiesService.getScriptProperties();
  var action = String(params.action || '').trim();
  var payload = {};

  if (bodyStr) {
    try { payload = JSON.parse(bodyStr); } catch (e) {}
  } else if (params.data) {
    try { payload = JSON.parse(params.data); } catch (e) {}
  }

  var email = String(params.email || payload.email || '').trim().toLowerCase().replace(/[^a-z0-9_@.-]/g, '');
  var user = String(params.user || payload.user || '').trim().toLowerCase().replace(/[^a-z0-9_@.-]/g, '');
  var pass = String(params.pass || payload.pass || '');
  var token = String(params.token || payload.token || '');

  // دعم الـ Probe لو مفيش داتا محلية ومعانا إيميل الصفحة
  if (action === 'probe') {
    if (!email) return { status: 'error', msg: 'No email for probe' };
    var lastUserForEmail = prop.getProperty('sm_email_map_' + email);
    if (!lastUserForEmail) return { status: 'error', msg: 'No mapped user' };
    var probeRaw = prop.getProperty('sm_acc_' + lastUserForEmail);
    if (!probeRaw) return { status: 'error', msg: 'Account not found' };
    var probeAcc = JSON.parse(probeRaw);
    return {
      status: 'ok',
      user: lastUserForEmail,
      token: makeToken(lastUserForEmail, probeAcc.passHash),
      data: {
        ts: probeAcc.ts || 0,
        rev: probeAcc.rev || '',
        count: probeAcc.count || 0,
        cfg: probeAcc.cfg || null,
        vals: probeAcc.vals || null
      }
    };
  }

  if (!user) {
    return { status: 'error', msg: 'Username required' };
  }

  var accKey = 'sm_acc_' + user;
  var savedAccRaw = prop.getProperty(accKey);
  var savedAcc = savedAccRaw ? JSON.parse(savedAccRaw) : null;
  var passHash = pass ? hashPwd(pass) : '';

  if (action === 'register') {
    if (!pass) return { status: 'error', msg: 'Password required' };
    if (savedAcc) {
      return { status: 'error', msg: 'Username already exists! Please login.' };
    }
    var initVals = payload.vals || {};
    var initCount = typeof payload.count === 'number' ? payload.count : (initVals._formCount || 0);
    var initRev = String(payload.rev || initVals._rev || Math.random().toString(36).substring(2, 8));
    var newAcc = {
      user: user,
      email: email,
      passHash: passHash,
      ts: payload.ts || Date.now(),
      rev: initRev,
      count: initCount,
      cfg: payload.cfg || null,
      vals: initVals
    };
    prop.setProperty(accKey, JSON.stringify(newAcc));
    if (email) prop.setProperty('sm_email_map_' + email, user);
    return {
      status: 'ok',
      token: makeToken(user, passHash),
      data: { ts: newAcc.ts, rev: newAcc.rev, count: newAcc.count, cfg: newAcc.cfg, vals: newAcc.vals }
    };
  }

  if (!savedAcc) {
    return { status: 'error', msg: 'Account not found! Click Register first.' };
  }

  var expectedToken = makeToken(user, savedAcc.passHash);
  var isValidAuth = (pass && savedAcc.passHash === passHash) || (token && token === expectedToken);
  if (!isValidAuth) {
    return { status: 'error', msg: 'Invalid session' };
  }

  if (email) prop.setProperty('sm_email_map_' + email, user);

  // فحص سريع جداً بالكود الصغير (rev) ومزامنة العداد أوتوماتيك
  if (action === 'ping') {
    var clientRev = String(payload.rev || '');
    var clientCount = typeof payload.count === 'number' ? payload.count : 0;
    var clientResetTs = typeof payload.countResetTs === 'number' ? payload.countResetTs : 0;

    savedAcc.vals = savedAcc.vals || {};
    var srvCount = typeof savedAcc.count === 'number' ? savedAcc.count : (savedAcc.vals._formCount || 0);
    var srvResetTs = savedAcc.vals._countResetTs || 0;
    var countChangedOnServer = false;

    if (clientResetTs > srvResetTs) {
      srvResetTs = clientResetTs;
      srvCount = clientCount;
      countChangedOnServer = true;
    } else if (clientResetTs === srvResetTs && clientCount > srvCount) {
      srvCount = clientCount;
      countChangedOnServer = true;
    }

    if (countChangedOnServer) {
      savedAcc.count = srvCount;
      savedAcc.vals._formCount = srvCount;
      savedAcc.vals._countResetTs = srvResetTs;
      prop.setProperty(accKey, JSON.stringify(savedAcc));
    }

    var srvRev = String(savedAcc.rev || savedAcc.vals._rev || '');
    if (!savedAcc.cfg || !savedAcc.cfg.url || (srvRev && srvRev === clientRev)) {
      return {
        status: 'ok',
        upToDate: true,
        rev: srvRev,
        count: srvCount,
        data: { vals: { _formCount: srvCount, _countResetTs: srvResetTs } }
      };
    }

    return {
      status: 'ok',
      upToDate: false,
      rev: srvRev,
      ts: savedAcc.ts || 0,
      count: srvCount,
      data: {
        ts: savedAcc.ts || 0,
        rev: srvRev,
        count: srvCount,
        cfg: savedAcc.cfg || null,
        vals: savedAcc.vals || null
      }
    };
  }

  if (action === 'login' || action === 'load') {
    var curCount = typeof savedAcc.count === 'number' ? savedAcc.count : (savedAcc.vals && savedAcc.vals._formCount) || 0;
    return {
      status: 'ok',
      token: expectedToken,
      data: {
        ts: savedAcc.ts || 0,
        rev: savedAcc.rev || (savedAcc.vals && savedAcc.vals._rev) || '',
        count: curCount,
        cfg: savedAcc.cfg || null,
        vals: savedAcc.vals || null
      }
    };
  }

  if (action === 'save') {
    savedAcc.ts = payload.ts || Date.now();
    if (payload.rev) savedAcc.rev = String(payload.rev);
    if (payload.cfg !== undefined && payload.cfg !== null) savedAcc.cfg = payload.cfg;
    if (payload.vals !== undefined && payload.vals !== null) {
      savedAcc.vals = payload.vals;
      if (typeof payload.vals._formCount === 'number') savedAcc.count = payload.vals._formCount;
      if (payload.vals._rev) savedAcc.rev = String(payload.vals._rev);
    }
    if (typeof payload.count === 'number') {
      savedAcc.count = payload.count;
      if (savedAcc.vals) savedAcc.vals._formCount = payload.count;
    }
    prop.setProperty(accKey, JSON.stringify(savedAcc));
    return { status: 'ok', ts: savedAcc.ts, rev: savedAcc.rev || '', count: savedAcc.count || 0 };
  }

  return { status: 'ready' };
}

function doGet(e) {
  var res = handleRequest((e && e.parameter) || {}, null);
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var body = (e && e.postData && e.postData.contents) ? e.postData.contents : null;
  var res = handleRequest((e && e.parameter) || {}, body);
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}