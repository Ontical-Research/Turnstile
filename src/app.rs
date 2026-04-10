use codemirror::{DocApi, Editor, EditorOptions, GutterId, Line};
use js_sys::{Function, Object, Reflect};
use leptos::prelude::*;
use leptos::web_sys::HtmlTextAreaElement;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::spawn_local;

const DIAG_GUTTER: GutterId = GutterId::new("lean-diagnostics");

#[derive(serde::Deserialize)]
struct DiagnosticInfo {
    start_line: u32,
    severity: u8,
    message: String,
}

fn tauri_module(name: &str) -> JsValue {
    let window = leptos::web_sys::window().unwrap();
    let tauri = Reflect::get(&window, &JsValue::from_str("__TAURI__")).unwrap();
    Reflect::get(&tauri, &JsValue::from_str(name)).unwrap()
}

fn tauri_invoke(cmd: &str, args: &JsValue) -> js_sys::Promise {
    let core = tauri_module("core");
    let invoke: Function = Reflect::get(&core, &JsValue::from_str("invoke"))
        .unwrap()
        .dyn_into()
        .unwrap();
    invoke
        .call2(&core, &JsValue::from_str(cmd), args)
        .unwrap()
        .dyn_into()
        .unwrap()
}

fn tauri_listen(event: &str, callback: &Function) -> js_sys::Promise {
    let event_mod = tauri_module("event");
    let listen: Function = Reflect::get(&event_mod, &JsValue::from_str("listen"))
        .unwrap()
        .dyn_into()
        .unwrap();
    listen
        .call2(&event_mod, &JsValue::from_str(event), callback)
        .unwrap()
        .dyn_into()
        .unwrap()
}

#[component]
pub fn App() -> impl IntoView {
    let textarea_ref = NodeRef::<leptos::html::Textarea>::new();

    textarea_ref.on_load(move |textarea| {
        let el: &HtmlTextAreaElement = &textarea;
        let options = EditorOptions::default()
            .line_numbers(true)
            .gutters(&[DIAG_GUTTER]);
        let editor = Editor::from_text_area(el, &options);

        // CodeMirror sets min-height as an inline style on .CodeMirror-scroll,
        // which beats any stylesheet rule. Override it directly after init.
        let document = leptos::web_sys::window().unwrap().document().unwrap();
        if let Some(scroll) = document.query_selector(".CodeMirror-scroll").unwrap() {
            let style = scroll
                .unchecked_into::<leptos::web_sys::HtmlElement>()
                .style();
            style.set_property("min-height", "0").unwrap();
            style.set_property("height", "100%").unwrap();
        }

        editor.on_change(|cm, _change| {
            let content = cm.value().unwrap_or_default();
            let args = Object::new();
            Reflect::set(
                &args,
                &JsValue::from_str("content"),
                &JsValue::from_str(&content),
            )
            .unwrap();
            spawn_local(async move {
                let _ = wasm_bindgen_futures::JsFuture::from(tauri_invoke(
                    "update_document",
                    &args.into(),
                ))
                .await;
            });
        });

        // Register the diagnostic listener before starting the LSP so no events are missed.
        let diag_cb = Closure::<dyn FnMut(JsValue)>::new(move |event: JsValue| {
            let payload =
                Reflect::get(&event, &JsValue::from_str("payload")).unwrap_or(JsValue::NULL);
            if let Ok(diagnostics) = serde_wasm_bindgen::from_value::<Vec<DiagnosticInfo>>(payload)
            {
                apply_diagnostics(&editor, &document, &diagnostics);
            }
        });
        // Leak the Closure so JS retains a live reference for the lifetime of the app.
        let diag_fn: Function = diag_cb.into_js_value().dyn_into().unwrap();

        spawn_local(async move {
            let _ = wasm_bindgen_futures::JsFuture::from(tauri_listen("lsp-diagnostics", &diag_fn))
                .await;
            start_lsp().await;
        });
    });

    view! {
        <textarea node_ref=textarea_ref></textarea>
    }
}

#[allow(clippy::future_not_send)] // WASM futures are inherently !Send
async fn start_lsp() {
    let status = wasm_bindgen_futures::JsFuture::from(tauri_invoke(
        "get_setup_status",
        &Object::new().into(),
    ))
    .await;

    let complete = status
        .as_ref()
        .ok()
        .and_then(|v| Reflect::get(v, &JsValue::from_str("complete")).ok())
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    if !complete {
        // Register the setup-progress listener before invoking start_setup to avoid
        // missing the "ready" event if setup completes before the listener is registered.
        let (tx, rx) = futures::channel::oneshot::channel::<()>();
        let tx = std::cell::Cell::new(Some(tx));
        let progress_cb = Closure::<dyn FnMut(JsValue)>::new(move |event: JsValue| {
            let payload =
                Reflect::get(&event, &JsValue::from_str("payload")).unwrap_or(JsValue::NULL);
            let phase = Reflect::get(&payload, &JsValue::from_str("phase"))
                .ok()
                .and_then(|v| v.as_string())
                .unwrap_or_default();
            if phase == "ready" || phase == "error" {
                if let Some(sender) = tx.take() {
                    let _ = sender.send(());
                }
            }
        });
        let progress_fn: Function = progress_cb.into_js_value().dyn_into().unwrap();

        let _ = wasm_bindgen_futures::JsFuture::from(tauri_listen("setup-progress", &progress_fn))
            .await;

        let _ = wasm_bindgen_futures::JsFuture::from(tauri_invoke(
            "start_setup",
            &Object::new().into(),
        ))
        .await;

        let _ = rx.await;
    }

    let _ = wasm_bindgen_futures::JsFuture::from(tauri_invoke("start_lsp", &Object::new().into()))
        .await;
}

fn apply_diagnostics(
    editor: &Editor,
    document: &leptos::web_sys::Document,
    diagnostics: &[DiagnosticInfo],
) {
    editor.clear_gutter(DIAG_GUTTER);

    for diag in diagnostics {
        let marker = document.create_element("div").unwrap();
        let (class, symbol) = match diag.severity {
            1 => ("lean-diag-error", "●"),
            2 => ("lean-diag-warning", "●"),
            _ => ("lean-diag-info", "●"),
        };
        marker.set_class_name(class);
        marker.set_attribute("title", &diag.message).unwrap();
        marker.set_inner_html(symbol);

        // CodeMirror lines are 0-indexed; our diagnostics are 1-indexed.
        let cm_line = Line::new(diag.start_line.saturating_sub(1));
        editor.set_gutter_marker(cm_line, DIAG_GUTTER, &marker);
    }
}
