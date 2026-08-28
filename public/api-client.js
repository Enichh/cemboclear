/**
 * CemboClear API client (vanilla JS, no dependencies).
 *
 * This is the single, authoritative bridge between the frontend and the backend
 * API. All network calls in Admin/Resident/Login/SignUp pages MUST go through
 * this file so that authentication (session cookie) and CSRF protection
 * (X-CSRF-Token header) are handled consistently and cannot be forgotten.
 *
 * Backend contract it implements:
 *   - Session cookie auth (SameSite=Lax, HttpOnly, Secure when HTTPS).
 *   - CSRF token returned by the backend on `POST /api/login` and `GET /api/me`
 *     under the `csrf_token` field. It must be sent back on every mutating
 *     request as the header `X-CSRF-Token`.
 *   - `GET /api/health` is public (no auth, no token needed).
 *
 * Usage:
 *   const client = CemboClear.client();      // get the shared instance
 *   await client.login({ email, password }); // stores session + csrf token
 *   const res = await client.get('/residents');
 *   const res = await client.post('/requests', { agency_id: 1, subject: '...' });
 */
(function (global) {
  'use strict';

  var CSRF_KEY = 'cemboclear.csrf';
  var PUBLIC_METHODS = { GET: true, HEAD: true, OPTIONS: true };

  /**
   * Derive the API base path so the client works whether the app is served
   * from the web root (/) or a subdirectory (e.g. /cemboclear/public).
   *
   * The frontend pages live in `public/`, and the backend front controller is
   * `public/api/index.php`, so the API base is the directory of the page plus
   * `/api`. We resolve it from the current `<script>` URL (this file), which is
   * bullet-proof regardless of rewrite rules.
   *
   * Override explicitly with `window.CEMBOCLEAR_API_BASE` if needed.
   */
  function resolveApiBase() {
    if (global.CEMBOCLEAR_API_BASE) {
      return String(global.CEMBOCLEAR_API_BASE).replace(/\/+$/, '');
    }

    // Locate this script's own src, e.g. "/cemboclear/public/api-client.js".
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].getAttribute('src');
      if (src && src.indexOf('api-client.js') !== -1) {
        // Directory containing api-client.js (the public dir) + "/api".
        return src.replace(/\/api-client\.js(\?.*)?$/, '').replace(/\/+$/, '') + '/api';
      }
    }

    // Fallback: relative to the current page's directory.
    return './api';
  }

  var API_BASE = resolveApiBase();

  /**
   * A small promise-based request helper that always:
   *   1. Reads and attaches the stored CSRF token for mutating methods.
   *   2. Sends credentials (session cookie) and JSON (or multipart) bodies.
   *   3. Parses the backend's JSON envelope and rejects on error statuses.
   *   4. Redirects to the login page on 401 (expired/absent session).
   */
  var ApiClient = function () {
    this.csrf = readStoredToken();
  };

  /** Store a freshly issued token (from login or /api/me). */
  ApiClient.prototype.setCsrfToken = function (token) {
    this.csrf = token ? String(token) : null;
    if (this.csrf) {
      try { global.localStorage.setItem(CSRF_KEY, this.csrf); } catch (e) {}
    } else {
      try { global.localStorage.removeItem(CSRF_KEY); } catch (e) {}
    }
  };

  ApiClient.prototype.clear = function () {
    this.setCsrfToken(null);
  };

  /** Core request. `body` is a plain object -> JSON; FormData -> multipart. */
  ApiClient.prototype.request = function (method, path, body) {
    var url = buildUrl(path);
    var isJson = body != null && typeof body === 'object' &&
                 typeof body.append !== 'function';

    var headers = { Accept: 'application/json' };

    if (isJson) {
      headers['Content-Type'] = 'application/json';
    }

    // Attach CSRF token to every state-changing request (backend enforces it).
    if (!PUBLIC_METHODS[method] && this.csrf) {
      headers['X-CSRF-Token'] = this.csrf;
    }

    var options = {
      method: method,
      headers: headers,
      credentials: 'same-origin',
      cache: 'no-store'
    };

    if (isJson) {
      options.body = JSON.stringify(body);
    } else if (body != null) {
      options.body = body; // FormData
    }

    return global.fetch(url, options).then(function (response) {
      return parseResponse(response).then(function (payload) {
        if (response.status === 401 && typeof global.redirectToLogin === 'function') {
          global.redirectToLogin();
        }
        if (!response.ok) {
          var err = new Error(payload && payload.message ? payload.message : 'Request failed');
          err.status = response.status;
          err.payload = payload;
          throw err;
        }
        return payload;
      });
    });
  };

  // Convenience verbs -------------------------------------------------------

  ApiClient.prototype.get = function (path) {
    return this.request('GET', path);
  };

  ApiClient.prototype.post = function (path, body) {
    return this.request('POST', path, body || {});
  };

  ApiClient.prototype.put = function (path, body) {
    return this.request('PUT', path, body || {});
  };

  ApiClient.prototype.del = function (path) {
    return this.request('DELETE', path);
  };

  // Auth convenience --------------------------------------------------------

  /** Login. On success the backend returns { message, user, csrf_token }. */
  ApiClient.prototype.login = function (identifier, password) {
    var self = this;
    return this.request('POST', '/login', {
      email: identifier,
      password: password
    }).then(function (res) {
      if (res && res.csrf_token) {
        self.setCsrfToken(res.csrf_token);
      }
      return res;
    });
  };

  /** Logout. Clears the local token afterward. */
  ApiClient.prototype.logout = function () {
    var self = this;
    return this.request('POST', '/logout', {}).then(function (res) {
      self.clear();
      return res;
    });
  };

  /** Fetch current user and refresh the CSRF token from `/api/me`. */
  ApiClient.prototype.me = function () {
    var self = this;
    return this.request('GET', '/me').then(function (res) {
      if (res && res.csrf_token) {
        self.setCsrfToken(res.csrf_token);
      }
      return res;
    });
  };

  // Internal helpers --------------------------------------------------------

  function readStoredToken() {
    try { return global.localStorage.getItem(CSRF_KEY) || null; } catch (e) { return null; }
  }

  function buildUrl(path) {
    var clean = String(path || '').replace(/^\/+/, '');
    if (clean.indexOf('api/') === 0) {
      clean = clean.substring(4);
    }
    return API_BASE + (clean ? '/' + clean : '');
  }

  function parseResponse(response) {
    var contentType = response.headers.get('content-type') || '';
    if (response.status === 204) {
      return Promise.resolve(null);
    }
    if (contentType.indexOf('application/json') !== -1) {
      return response.json().catch(function () { return null; });
    }
    return response.text();
  }

  // Singleton + factory -----------------------------------------------------

  var singleton = null;

  function client() {
    if (!singleton) {
      singleton = new ApiClient();
    }
    return singleton;
  }

  global.CemboClear = {
    client: client,
    ApiClient: ApiClient
  };
})(typeof window !== 'undefined' ? window : globalThis);
