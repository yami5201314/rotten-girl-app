//! rgmedia 协议：hls.js / <img> 请求本协议，Rust 带上 Cookie（rg_pb、rg_sid）转发到站点（用户 2026-11-16 选择本地媒体代理）。
//! 只放行播放与封面所需的 GET 路径，其余 403。

use http::{Request, Response, StatusCode};
use tauri::{Manager, Runtime, UriSchemeContext, UriSchemeResponder};

use crate::net::Net;

pub const SCHEME: &str = "rgmedia";

/// 允许转发的路径：HLS 清单 / 分片、封面、AES 密钥、字幕。
pub fn allowed_media_path(path: &str) -> bool {
    if path.split('/').any(|seg| seg == "..") {
        return false;
    }
    if path.starts_with("/media/") || path.starts_with("/covers/") || path.starts_with("/api/v1/playback/keys/") {
        return true;
    }
    // /api/v1/playback-sessions/{id}/subtitles/{locale}
    let parts: Vec<&str> = path.trim_start_matches('/').split('/').collect();
    parts.len() == 6 && parts[..3] == ["api", "v1", "playback-sessions"] && parts[4] == "subtitles"
}

fn plain(status: StatusCode) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header("Access-Control-Allow-Origin", "*")
        .body(Vec::new())
        .expect("static response")
}

pub fn handle<R: Runtime>(ctx: UriSchemeContext<'_, R>, request: Request<Vec<u8>>, responder: UriSchemeResponder) {
    let app = ctx.app_handle().clone();
    tauri::async_runtime::spawn(async move {
        let uri = request.uri();
        let path = uri.path().to_string();
        if request.method() == http::Method::OPTIONS {
            let mut res = plain(StatusCode::NO_CONTENT);
            res.headers_mut().insert("Access-Control-Allow-Headers", http::HeaderValue::from_static("*"));
            return responder.respond(res);
        }
        if request.method() != http::Method::GET || !allowed_media_path(&path) {
            return responder.respond(plain(StatusCode::FORBIDDEN));
        }
        let net = app.state::<Net>();
        let target = match uri.query() {
            Some(q) => format!("{path}?{q}"),
            None => path,
        };
        let Some(url) = net.url_for(&target) else {
            return responder.respond(plain(StatusCode::FORBIDDEN));
        };
        let mut req = net.client.get(url);
        if let Some(range) = request.headers().get(http::header::RANGE) {
            req = req.header(http::header::RANGE, range.clone());
        }
        let res = match req.send().await {
            Ok(r) => r,
            Err(_) => return responder.respond(plain(StatusCode::BAD_GATEWAY)),
        };
        let status = res.status();
        let mut builder = Response::builder()
            .status(status.as_u16())
            .header("Access-Control-Allow-Origin", "*")
            .header("Cache-Control", "no-store");
        for name in [http::header::CONTENT_TYPE, http::header::CONTENT_RANGE, http::header::ACCEPT_RANGES] {
            if let Some(v) = res.headers().get(&name) {
                builder = builder.header(name, v.clone());
            }
        }
        let body = res.bytes().await.map(|b| b.to_vec()).unwrap_or_default();
        responder.respond(builder.body(body).unwrap_or_else(|_| plain(StatusCode::BAD_GATEWAY)));
    });
}

#[cfg(test)]
mod tests {
    use super::allowed_media_path;

    #[test]
    fn allows_media_paths() {
        assert!(allowed_media_path("/media/sid/asset/v1/master.m3u8"));
        assert!(allowed_media_path("/covers/abc"));
        assert!(allowed_media_path("/api/v1/playback/keys/variant-id"));
        assert!(allowed_media_path("/api/v1/playback-sessions/sid/subtitles/zh-CN"));
    }

    #[test]
    fn rejects_other_paths() {
        assert!(!allowed_media_path("/api/v1/me"));
        assert!(!allowed_media_path("/api/v1/playback-sessions/sid/refresh"));
        assert!(!allowed_media_path("/media/../api/v1/me"));
        assert!(!allowed_media_path("/console/admin"));
    }
}
