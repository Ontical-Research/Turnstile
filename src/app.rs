use std::cell::RefCell;
use std::rc::Rc;

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

#[derive(serde::Deserialize)]
struct SemanticToken {
    line: u32, // 1-indexed (matches backend convention)
    col: u32,
    length: u32,
    token_type: String,
}

fn token_type_to_css_class(token_type: &str) -> Option<&'static str> {
    match token_type {
        "keyword" | "modifier" => Some("cm-lean-keyword"),
        "type" | "class" | "struct" | "enum" | "interface" | "typeParameter" => {
            Some("cm-lean-type")
        }
        "function" | "method" => Some("cm-lean-function"),
        "variable" | "parameter" | "property" => Some("cm-lean-variable"),
        "namespace" => Some("cm-lean-namespace"),
        "enumMember" => Some("cm-lean-enum-member"),
        "macro" => Some("cm-lean-macro"),
        "comment" => Some("cm-lean-comment"),
        "string" => Some("cm-lean-string"),
        "number" => Some("cm-lean-number"),
        "operator" => Some("cm-lean-operator"),
        "decorator" => Some("cm-lean-decorator"),
        _ => None,
    }
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

/// Call `cm.markText(from, to, {className})` and return the `TextMarker` `JsValue`.
fn cm_mark_text(cm: &JsValue, line: u32, from_ch: u32, to_ch: u32, class: &str) -> JsValue {
    let mark_fn: Function = Reflect::get(cm, &JsValue::from_str("markText"))
        .unwrap()
        .dyn_into()
        .unwrap();
    let from = Object::new();
    Reflect::set(&from, &"line".into(), &JsValue::from_f64(f64::from(line))).unwrap();
    Reflect::set(&from, &"ch".into(), &JsValue::from_f64(f64::from(from_ch))).unwrap();
    let to = Object::new();
    Reflect::set(&to, &"line".into(), &JsValue::from_f64(f64::from(line))).unwrap();
    Reflect::set(&to, &"ch".into(), &JsValue::from_f64(f64::from(to_ch))).unwrap();
    let opts = Object::new();
    Reflect::set(&opts, &"className".into(), &JsValue::from_str(class)).unwrap();
    mark_fn
        .call3(cm, &from.into(), &to.into(), &opts.into())
        .unwrap_or(JsValue::UNDEFINED)
}

/// Call `.clear()` on each `TextMarker` `JsValue` in the slice.
fn clear_marks(markers: &[JsValue]) {
    for marker in markers {
        if let Ok(f) = Reflect::get(marker, &JsValue::from_str("clear"))
            .and_then(wasm_bindgen::JsCast::dyn_into::<Function>)
        {
            let _ = f.call0(marker);
        }
    }
}

fn apply_semantic_tokens(
    cm: &JsValue,
    markers: &Rc<RefCell<Vec<JsValue>>>,
    tokens: &[SemanticToken],
) {
    let mut m = markers.borrow_mut();
    clear_marks(&m);
    m.clear();
    for token in tokens {
        if let Some(class) = token_type_to_css_class(&token.token_type) {
            let cm_line = token.line.saturating_sub(1); // 1-indexed → 0-indexed
            let marker = cm_mark_text(cm, cm_line, token.col, token.col + token.length, class);
            if !marker.is_undefined() {
                m.push(marker);
            }
        }
    }
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

        // Get the raw CodeMirror JS instance from the wrapper div.
        // CodeMirror sets `wrapper.CodeMirror = this` on init (codemirror.js:7931).
        let wrapper = document.query_selector(".CodeMirror").unwrap().unwrap();
        let cm_js = Reflect::get(&wrapper.into(), &JsValue::from_str("CodeMirror"))
            .unwrap_or(JsValue::UNDEFINED);
        let cm_rc = Rc::new(cm_js);

        // Shared marker vec for clearing old marks on token refresh.
        let tokens_markers: Rc<RefCell<Vec<JsValue>>> = Rc::new(RefCell::new(Vec::new()));

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

        // Register listeners before starting the LSP so no events are missed.
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

        let cm_for_tokens = Rc::clone(&cm_rc);
        let markers_for_cb = Rc::clone(&tokens_markers);
        let tokens_cb = Closure::<dyn FnMut(JsValue)>::new(move |event: JsValue| {
            let payload =
                Reflect::get(&event, &JsValue::from_str("payload")).unwrap_or(JsValue::NULL);
            if let Ok(tokens) = serde_wasm_bindgen::from_value::<Vec<SemanticToken>>(payload) {
                apply_semantic_tokens(&cm_for_tokens, &markers_for_cb, &tokens);
            }
        });
        let tokens_fn: Function = tokens_cb.into_js_value().dyn_into().unwrap();

        spawn_local(async move {
            let _ = wasm_bindgen_futures::JsFuture::from(tauri_listen(
                "lsp-semantic-tokens",
                &tokens_fn,
            ))
            .await;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keyword_maps_to_cm_lean_keyword() {
        assert_eq!(token_type_to_css_class("keyword"), Some("cm-lean-keyword"));
    }

    #[test]
    fn type_variants_map_to_cm_lean_type() {
        for t in &[
            "type",
            "class",
            "struct",
            "enum",
            "interface",
            "typeParameter",
        ] {
            assert!(
                token_type_to_css_class(t).is_some(),
                "{t} should have a mapping"
            );
        }
    }

    #[test]
    fn unknown_token_type_returns_none() {
        assert_eq!(token_type_to_css_class("unknown_future_type"), None);
    }
}
