//! api_request 命令：界面唯一的后端出口，路径限 /api/v1/。

use serde::Serialize;
use serde_json::Value;
use tauri::State;

use crate::net::Net;

#[derive(Serialize)]
pub struct ApiResponse {
    pub status: u16,
    pub body: Value,
}

const API_PREFIX: &str = "/api/v1/";

/// 路径必须是 /api/v1/ 下的相对路径，且不含 .. 段。
pub fn valid_api_path(path: &str) -> bool {
    path.starts_with(API_PREFIX) && !path.split(['/', '?']).any(|seg| seg == "..")
}

#[tauri::command]
pub async fn api_request(
    net: State<'_, Net>,
    method: String,
    path: String,
    body: Option<Value>,
    idempotency_key: Option<String>,
) -> Result<ApiResponse, String> {
    if !valid_api_path(&path) {
        return Err("PATH_NOT_ALLOWED".into());
    }
    let url = net.url_for(&path).ok_or("PATH_NOT_ALLOWED")?;
    let method = match method.as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "PATCH" => reqwest::Method::PATCH,
        "DELETE" => reqwest::Method::DELETE,
        _ => return Err("METHOD_NOT_ALLOWED".into()),
    };
    let write = method != reqwest::Method::GET;
    let mut req = net.client.request(method, url).header("Accept", "application/json");
    if write {
        // 后端 OriginGuard / jsonOnly / CSRF 要求；身份只来自 Cookie，界面传不了 user_id
        req = req.header("Origin", net.origin()).header("Content-Type", "application/json");
        if let Some(token) = net.csrf_token() {
            req = req.header("X-CSRF-Token", token);
        }
        req = req.body(body.map(|b| b.to_string()).unwrap_or_default());
    }
    if let Some(key) = idempotency_key {
        req = req.header("Idempotency-Key", key);
    }
    let res = req.send().await.map_err(|_| "NETWORK_ERROR".to_string())?;
    let status = res.status().as_u16();
    let set_cookie = res.headers().contains_key(reqwest::header::SET_COOKIE);
    let text = res.text().await.map_err(|_| "NETWORK_ERROR".to_string())?;
    if set_cookie {
        net.persist();
    }
    let body = if text.is_empty() { Value::Null } else { serde_json::from_str(&text).unwrap_or(Value::Null) };
    Ok(ApiResponse { status, body })
}

#[cfg(test)]
mod tests {
    use super::valid_api_path;

    #[test]
    fn allows_api_v1_paths() {
        assert!(valid_api_path("/api/v1/dramas?limit=6&locale=zh-CN"));
        assert!(valid_api_path("/api/v1/episodes/abc/playback-sessions"));
    }

    #[test]
    fn rejects_other_paths() {
        assert!(!valid_api_path("/api/admin/v1/users"));
        assert!(!valid_api_path("http://evil.example/api/v1/x"));
        assert!(!valid_api_path("//evil.example/api/v1/x"));
        assert!(!valid_api_path("/api/v1/../admin/v1/users"));
        assert!(!valid_api_path("/media/x"));
    }
}
