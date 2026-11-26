use std::ffi::{c_char, c_void, CString};
use std::sync::Mutex;

// product ids must match the App Store Connect records; jelly amounts
// are the grant the frontend applies on a completed purchase. They
// mirror the direct-build GEM_PACKS tiers so value stays consistent
// across channels.
pub const PACKS: [(&str, i64); 4] = [
    ("com.jellypal.jelly.small", 250),
    ("com.jellypal.jelly.medium", 500),
    ("com.jellypal.jelly.large", 1000),
    ("com.jellypal.jelly.xl", 2500),
];

// purchasable product (price string is localized by the store itself)
struct Prod {
    id: String,
    title: String,
    price: String,
    raw: *const c_void, // retained SKProduct — needed to build a payment
}
unsafe impl Send for Prod {}

// EVENTS: one-shot notifications (restored/failed) the frontend drains.
// PENDING: purchased transactions awaiting a grant ack — they are NOT
// finished until iap_ack runs, so a crash between delivery and grant
// makes StoreKit redeliver them on the next launch. Pointers are
// retained; unfinished transactions live in the queue either way.
static EVENTS: Mutex<Vec<serde_json::Value>> = Mutex::new(Vec::new());
struct PendingTransaction {
    handle: usize,
    id: String,
    product: String,
}
static PENDING: Mutex<Vec<PendingTransaction>> = Mutex::new(Vec::new());
static PRODUCTS: Mutex<Vec<Prod>> = Mutex::new(Vec::new());
static LIVE_REQS: Mutex<Vec<usize>> = Mutex::new(Vec::new());
static OBSERVER: Mutex<usize> = Mutex::new(0);
static DELEGATE: Mutex<usize> = Mutex::new(0);

// linking the framework is what registers SK* classes with the runtime
// — without it objc_getClass returns null and IAP silently dies
#[link(name = "StoreKit", kind = "framework")]
extern "C" {}
#[link(name = "objc", kind = "dylib")]
extern "C" {
    fn objc_getClass(name: *const c_char) -> *const c_void;
    fn sel_registerName(name: *const c_char) -> *const c_void;
    fn objc_allocateClassPair(
        sup: *const c_void,
        name: *const c_char,
        extra: usize,
    ) -> *const c_void;
    fn class_addMethod(
        cls: *const c_void,
        sel: *const c_void,
        imp: *const c_void,
        types: *const c_char,
    ) -> bool;
    fn objc_registerClassPair(cls: *const c_void);
    #[link_name = "objc_msgSend"]
    fn send0(obj: *const c_void, sel: *const c_void) -> *const c_void;
    #[link_name = "objc_msgSend"]
    fn send_obj(obj: *const c_void, sel: *const c_void, a: *const c_void) -> *const c_void;
    #[link_name = "objc_msgSend"]
    fn send_objs(
        obj: *const c_void,
        sel: *const c_void,
        a: *const c_void,
        b: *const c_void,
    ) -> *const c_void;
    #[link_name = "objc_msgSend"]
    fn send_cstr(obj: *const c_void, sel: *const c_void, a: *const c_char) -> *const c_void;
    #[link_name = "objc_msgSend"]
    fn send_usize(obj: *const c_void, sel: *const c_void) -> usize;
    #[link_name = "objc_msgSend"]
    fn send_idx(obj: *const c_void, sel: *const c_void, a: usize) -> *const c_void;
    #[link_name = "objc_msgSend"]
    fn send_isize(obj: *const c_void, sel: *const c_void) -> isize;
    #[link_name = "objc_msgSend"]
    fn send_cstr_ret(obj: *const c_void, sel: *const c_void) -> *const c_char;
}

unsafe fn cls(n: &[u8]) -> *const c_void {
    objc_getClass(n.as_ptr() as *const c_char)
}
unsafe fn sel(n: &[u8]) -> *const c_void {
    sel_registerName(n.as_ptr() as *const c_char)
}
unsafe fn ns_str(s: &str) -> *const c_void {
    let c = CString::new(s).unwrap_or_default();
    send_cstr(
        cls(b"NSString\0"),
        sel(b"stringWithUTF8String:\0"),
        c.as_ptr(),
    )
}
unsafe fn rs_str(ns: *const c_void) -> String {
    if ns.is_null() {
        return String::new();
    }
    let p = send_cstr_ret(ns, sel(b"UTF8String\0"));
    if p.is_null() {
        return String::new();
    }
    std::ffi::CStr::from_ptr(p).to_string_lossy().into_owned()
}
unsafe fn retain(o: *const c_void) -> *const c_void {
    send0(o, sel(b"retain\0"))
}
unsafe fn release(o: *const c_void) {
    send0(o, sel(b"release\0"));
}
fn jelly_for(pid: &str) -> i64 {
    PACKS
        .iter()
        .find(|(id, _)| id == &pid)
        .map(|(_, j)| *j)
        .unwrap_or(0)
}
fn push(ev: serde_json::Value) {
    crate::lock_recover(&EVENTS).push(ev);
}

// paymentQueue:updatedTransactions: — the only required observer method
extern "C" fn on_updated(
    _s: *const c_void,
    _c: *const c_void,
    queue: *const c_void,
    txs: *const c_void,
) {
    unsafe {
        let n = send_usize(txs, sel(b"count\0"));
        for i in 0..n {
            let tx = send_idx(txs, sel(b"objectAtIndex:\0"), i);
            if tx.is_null() {
                continue;
            }
            let state = send_isize(tx, sel(b"transactionState\0"));
            let pay = send0(tx, sel(b"payment\0"));
            let pid = rs_str(send0(pay, sel(b"productIdentifier\0")));
            match state {
                1 => {
                    // purchased: retain the tx and park it in PENDING —
                    // drain surfaces it, iap_ack finishes it. No event
                    // push here; drain synthesizes one per pending tx.
                    // Object addresses change on relaunch and can be reused.
                    // StoreKit's identifier survives redelivery after a crash.
                    let identifier = rs_str(send0(tx, sel(b"transactionIdentifier\0")));
                    if identifier.is_empty() {
                        continue; // keep unfinished until StoreKit supplies it
                    }
                    let id = format!("sk:{identifier}");
                    let mut pend = crate::lock_recover(&PENDING);
                    if !pend.iter().any(|pending| pending.id == id) {
                        retain(tx);
                        pend.push(PendingTransaction {
                            handle: tx as usize,
                            id,
                            product: pid,
                        });
                    }
                }
                3 => {
                    // restored: consumables are not restorable, so this
                    // is informational only — no grant, finish now.
                    push(serde_json::json!({ "kind": "restored", "product": pid }));
                    send_obj(queue, sel(b"finishTransaction:\0"), tx);
                }
                2 => {
                    let err = send0(tx, sel(b"error\0"));
                    let code = if err.is_null() {
                        -1
                    } else {
                        send_isize(err, sel(b"code\0"))
                    };
                    // SKErrorPaymentCancelled = 2: user tap-out, quiet UI
                    push(serde_json::json!({
                        "kind": "failed", "product": pid, "code": code,
                    }));
                    send_obj(queue, sel(b"finishTransaction:\0"), tx);
                }
                _ => {} // 0 purchasing, 4 deferred — just wait
            }
        }
    }
}

// productsRequest:didReceiveResponse: — cache product objects (retained)
// so buy() can build real SKPayment instances, not the deprecated
// identifier-only path. Releases the finished request.
extern "C" fn on_products(
    _s: *const c_void,
    _c: *const c_void,
    req: *const c_void,
    resp: *const c_void,
) {
    unsafe {
        let arr = send0(resp, sel(b"products\0"));
        let n = if arr.is_null() {
            0
        } else {
            send_usize(arr, sel(b"count\0"))
        };
        let mut fresh = Vec::new();
        for i in 0..n {
            let p = send_idx(arr, sel(b"objectAtIndex:\0"), i);
            if p.is_null() {
                continue;
            }
            let id = rs_str(send0(p, sel(b"productIdentifier\0")));
            let title = rs_str(send0(p, sel(b"localizedTitle\0")));
            // localized price: NSNumberFormatter currency + product locale
            let price_obj = send0(p, sel(b"price\0"));
            let loc = send0(p, sel(b"priceLocale\0"));
            let fmt = send0(
                send0(cls(b"NSNumberFormatter\0"), sel(b"alloc\0")),
                sel(b"init\0"),
            );
            send_idx(fmt, sel(b"setNumberStyle:\0"), 2); // NSNumberFormatterCurrencyStyle
            send_obj(fmt, sel(b"setLocale:\0"), loc);
            let price = rs_str(send_obj(fmt, sel(b"stringFromNumber:\0"), price_obj));
            release(fmt);
            fresh.push(Prod {
                id,
                title,
                price,
                raw: retain(p),
            });
        }
        *crate::lock_recover(&PRODUCTS) = fresh;
        // drop the request from the live set and release our +1
        let mut live = crate::lock_recover(&LIVE_REQS);
        if let Some(pos) = live.iter().position(|&r| r == req as usize) {
            live.remove(pos);
        }
        drop(live);
        release(req);
    }
}

// request:didFailWithError: — the request is dead either way; drop our
// retain and tell the frontend so the shop does not look frozen
extern "C" fn on_req_failed(
    _s: *const c_void,
    _c: *const c_void,
    req: *const c_void,
    _err: *const c_void,
) {
    let mut live = crate::lock_recover(&LIVE_REQS);
    if let Some(pos) = live.iter().position(|&r| r == req as usize) {
        live.remove(pos);
    }
    drop(live);
    push(serde_json::json!({ "kind": "catalog_failed" }));
    unsafe {
        release(req);
    }
}

// build a one-method class implementing the given selector; NSObject
// parent so alloc/init exist
unsafe fn make_class(name: &[u8], sel_name: &[u8], imp: *const c_void) -> *const c_void {
    let sup = cls(b"NSObject\0");
    let c = objc_allocateClassPair(sup, name.as_ptr() as *const c_char, 0);
    if c.is_null() {
        return c;
    }
    class_addMethod(c, sel(sel_name), imp, b"v@:@@\0".as_ptr() as *const c_char);
    objc_registerClassPair(c);
    c
}

fn ensure_runtime() {
    let mut obs = crate::lock_recover(&OBSERVER);
    if *obs != 0 {
        return;
    }
    unsafe {
        let ocls = make_class(
            b"JPStoreObserver\0",
            b"paymentQueue:updatedTransactions:\0",
            on_updated as *const c_void,
        );
        let dcls = make_class(
            b"JPIapDelegate\0",
            b"productsRequest:didReceiveResponse:\0",
            on_products as *const c_void,
        );
        if !dcls.is_null() {
            class_addMethod(
                dcls,
                sel(b"request:didFailWithError:\0"),
                on_req_failed as *const c_void,
                b"v@:@@\0".as_ptr() as *const c_char,
            );
        }
        if ocls.is_null() || dcls.is_null() {
            return;
        }
        let observer = send0(send0(ocls, sel(b"alloc\0")), sel(b"init\0"));
        let delegate = send0(send0(dcls, sel(b"alloc\0")), sel(b"init\0"));
        let queue = send0(cls(b"SKPaymentQueue\0"), sel(b"defaultQueue\0"));
        send_obj(queue, sel(b"addTransactionObserver:\0"), observer);
        *obs = observer as usize;
        *crate::lock_recover(&DELEGATE) = delegate as usize;
    }
}

pub fn ready() -> bool {
    unsafe {
        let q = cls(b"SKPaymentQueue\0");
        if q.is_null() {
            return false;
        }
        #[link(name = "objc", kind = "dylib")]
        extern "C" {
            #[link_name = "objc_msgSend"]
            fn send_bool0(obj: *const c_void, sel: *const c_void) -> bool;
        }
        send_bool0(q, sel(b"canMakePayments\0"))
    }
}

pub fn refresh() -> Result<(), String> {
    if !ready() {
        return Err("purchases are disabled on this device".into());
    }
    ensure_runtime();
    unsafe {
        // NSString** array of ids -> NSArray -> NSSet
        let mut ids: Vec<*const c_void> = PACKS.iter().map(|(id, _)| ns_str(id)).collect();
        let arr = send_objs(
            cls(b"NSArray\0"),
            sel(b"arrayWithObjects:count:\0"),
            ids.as_mut_ptr() as *const c_void,
            ids.len() as *const c_void,
        );
        let set = send_obj(cls(b"NSSet\0"), sel(b"setWithArray:\0"), arr);
        let req = send_obj(
            send0(cls(b"SKProductsRequest\0"), sel(b"alloc\0")),
            sel(b"initWithProductIdentifiers:\0"),
            set,
        );
        if req.is_null() {
            return Err("products request could not start".into());
        }
        let delegate = *crate::lock_recover(&DELEGATE) as *const c_void;
        send_obj(req, sel(b"setDelegate:\0"), delegate);
        crate::lock_recover(&LIVE_REQS).push(req as usize);
        send0(req, sel(b"start\0"));
    }
    Ok(())
}

pub fn buy(product_id: &str) -> Result<(), String> {
    if !ready() {
        return Err("purchases are disabled on this device".into());
    }
    ensure_runtime();
    let prods = crate::lock_recover(&PRODUCTS);
    let raw = prods
        .iter()
        .find(|p| p.id == product_id)
        .map(|p| p.raw)
        .ok_or_else(|| "product not loaded yet — refresh the shop".to_string())?;
    unsafe {
        let pay = send_obj(cls(b"SKPayment\0"), sel(b"paymentWithProduct:\0"), raw);
        let queue = send0(cls(b"SKPaymentQueue\0"), sel(b"defaultQueue\0"));
        send_obj(queue, sel(b"addPayment:\0"), pay);
    }
    Ok(())
}

pub fn products_json() -> serde_json::Value {
    let prods = crate::lock_recover(&PRODUCTS);
    let list: Vec<serde_json::Value> = prods
        .iter()
        .map(|p| {
            serde_json::json!({
                "id": p.id, "title": p.title, "price": p.price, "jelly": jelly_for(&p.id),
            })
        })
        .collect();
    serde_json::json!(list)
}

// drain surfaces every unfinished purchase once per call — the frontend
// dedupes by tx id and acks after crediting jelly. Re-surfacing on each
// drain means a lost ack is retried by the next poll instead of lost.
pub fn drain_json() -> serde_json::Value {
    let mut out: Vec<serde_json::Value> = crate::lock_recover(&PENDING)
        .iter()
        .map(|pending| {
            serde_json::json!({
                "kind": "purchased", "product": pending.product,
                "jelly": jelly_for(&pending.product), "tx": pending.id,
            })
        })
        .collect();
    let evs: Vec<serde_json::Value> = crate::lock_recover(&EVENTS).drain(..).collect();
    out.extend(evs);
    serde_json::json!(out)
}

// grant acknowledged by the frontend — finish the transaction and
// release our hold on it
pub fn ack(tx_str: &str) {
    let mut pend = crate::lock_recover(&PENDING);
    let Some(pos) = pend.iter().position(|pending| pending.id == tx_str) else {
        return;
    };
    let tx = pend.remove(pos).handle;
    drop(pend);
    unsafe {
        let queue = send0(cls(b"SKPaymentQueue\0"), sel(b"defaultQueue\0"));
        send_obj(queue, sel(b"finishTransaction:\0"), tx as *const c_void);
        release(tx as *const c_void);
    }
}
