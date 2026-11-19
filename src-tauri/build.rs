use std::{env, fs, path::PathBuf};

/// 站点地址按优先级取：环境变量 RG_SITE_ORIGIN（CI 用 Secrets 注入）> app.config.json（本地，不入库）> app.config.example.json（占位）。
fn main() {
    println!("cargo:rerun-if-env-changed=RG_SITE_ORIGIN");
    println!("cargo:rerun-if-changed=../app.config.json");
    println!("cargo:rerun-if-changed=../app.config.example.json");

    let origin = env::var("RG_SITE_ORIGIN").ok().filter(|v| !v.trim().is_empty()).unwrap_or_else(|| {
        let local = PathBuf::from("../app.config.json");
        let file = if local.exists() { local } else { PathBuf::from("../app.config.example.json") };
        let raw = fs::read_to_string(&file).unwrap_or_else(|e| panic!("读取 {} 失败：{e}", file.display()));
        let v: serde_json::Value = serde_json::from_str(&raw).expect("app config 不是合法 JSON");
        v["siteOrigin"].as_str().expect("app config 缺少 siteOrigin").to_owned()
    });
    println!("cargo:rustc-env=RG_SITE_ORIGIN={}", origin.trim());

    tauri_build::build()
}
