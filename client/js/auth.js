(function () {
  var DEMO_ADMIN = { identifier: '/*$/eco555', password: 'eco555' };
  var USER_KEY = 'ecoexchange_users';
  var SESSION_KEY = 'currentUser';
  var LEGACY_SESSION_KEY = 'ecoexchange_session';

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (error) { return fallback; }
  }
  function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function users() { return read(USER_KEY, []); }
  function normalize(user) {
    if (!user || (user.role !== 'USER' && user.role !== 'ADMIN' && user.role !== 'INDUSTRY')) return null;
    if (user.role === 'INDUSTRY') user = Object.assign({}, user, { role: 'USER' });
    return user;
  }
  function session() {
    var storedCurrent = localStorage.getItem(SESSION_KEY);
    if (storedCurrent !== null) return normalize(read(SESSION_KEY, null));
    var legacy = normalize(read(LEGACY_SESSION_KEY, null));
    if (legacy) setSession(legacy);
    return legacy;
  }
  function setSession(user) {
    var normalized = normalize(user);
    if (!normalized) return;
    write(SESSION_KEY, normalized);
    write(LEGACY_SESSION_KEY, normalized);
  }
  function clearSession() { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(LEGACY_SESSION_KEY); }
  function register(data) {
    var all = users();
    if (all.some(function (item) { return item.email.toLowerCase() === data.email.toLowerCase(); })) throw new Error('An account with this email already exists.');
    var user = Object.assign({ id: 'USR-' + Date.now(), role: 'USER', createdAt: new Date().toISOString() }, data);
    delete user.confirmPassword;
    all.push(user); write(USER_KEY, all); setSession(user); return user;
  }
  function login(email, password) {
    if (email === DEMO_ADMIN.identifier && password === DEMO_ADMIN.password) {
      var admin = { id: 'ADMIN-DEMO', industryName: 'EcoExchange Admin', ownerName: 'Platform Admin', email: DEMO_ADMIN.identifier, location: 'Head Office', contactNumber: 'Demo account', role: 'ADMIN', createdAt: new Date().toISOString() };
      setSession(admin); return admin;
    }
    var user = users().find(function (item) { return item.email.toLowerCase() === email.toLowerCase() && item.password === password; });
    if (!user) throw new Error('Invalid email or password.');
    user = normalize(user);
    setSession(user); return user;
  }
  window.EcoAuth = { DEMO_ADMIN: DEMO_ADMIN, read: read, write: write, users: users, session: session, setSession: setSession, clearSession: clearSession, register: register, login: login };
}());
