// 发布版 Windows 不弹控制台
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    rotten_girl_app_lib::run()
}
