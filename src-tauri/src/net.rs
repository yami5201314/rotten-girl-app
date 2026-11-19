//! 网络层：界面不直连后端，统一经 Rust 代发（用户 2026-11-16 选择）。
//! 会话 Cookie（rg_sid / rg_csrf / rg_pb）只存在本进程与 App 私有目录，不交给 WebView。

use std::fs::File;
use std::io::{BufReader, BufWriter};
use std::path::PathBuf;
use std::sync::Arc;

use reqwest_cookie_store::{CookieStore, CookieStoreMutex};
use url::Url;

pub const CSRF_COOKIE: &str = "rg_csrf";

pub struct Net {
    pub client: reqwest::Client,
    pub jar: Arc<CookieStoreMutex>,
    pub site: Url,
    cookie_file: PathBuf,
}

impl Net {
    pub fn new(site: Url, cookie_file: PathBuf) -> Result<Self, String> {
        let store = File::open(&cookie_file)
            .ok()
            .and_then(|f| cookie_store::serde::json::load(BufReader::new(f)).ok())
            .unwrap_or_else(CookieStore::default);
        let jar = Arc::new(CookieStoreMutex::new(store));
        let roots = rustls::RootCertStore::from_iter(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
        let tls = rustls::ClientConfig::builder_with_provider(Arc::new(rustls::crypto::ring::default_provider()))
            .with_safe_default_protocol_versions()
            .map_err(|e| e.to_string())?
            .with_root_certificates(roots)
            .with_no_client_auth();
        let client = reqwest::Client::builder()
            .cookie_provider(jar.clone())
            .tls_backend_preconfigured(tls)
            .redirect(reqwest::redirect::Policy::none())
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| e.to_string())?;
        Ok(Self { client, jar, site, cookie_file })
    }

    /// 站点源（不带路径），用作写请求的 Origin，须在后端 ALLOWED_ORIGINS 白名单内。
    pub fn origin(&self) -> String {
        self.site.origin().ascii_serialization()
    }

    /// 只允许拼出与站点同源的地址，防止界面传入绝对地址把 Cookie 带到别处。
    pub fn url_for(&self, path_and_query: &str) -> Option<Url> {
        if !path_and_query.starts_with('/') || path_and_query.starts_with("//") {
            return None;
        }
        let url = self.site.join(path_and_query).ok()?;
        (url.origin() == self.site.origin()).then_some(url)
    }

    pub fn csrf_token(&self) -> Option<String> {
        let store = self.jar.lock().ok()?;
        let host = self.site.host_str()?;
        store.get(host, "/", CSRF_COOKIE).map(|c| c.value().to_string())
    }

    pub fn persist(&self) {
        let Ok(store) = self.jar.lock() else { return };
        if let Some(dir) = self.cookie_file.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        if let Ok(f) = File::create(&self.cookie_file) {
            let _ = cookie_store::serde::json::save(&store, &mut BufWriter::new(f));
        }
    }
}
