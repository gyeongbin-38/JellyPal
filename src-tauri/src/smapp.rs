use std::ffi::{c_char, c_void};

// linking the framework is what registers the class with the runtime
#[link(name = "ServiceManagement", kind = "framework")]
extern "C" {}

#[link(name = "objc", kind = "dylib")]
extern "C" {
    fn objc_getClass(name: *const c_char) -> *const c_void;
    fn sel_registerName(name: *const c_char) -> *const c_void;
    #[link_name = "objc_msgSend"]
    fn send0(obj: *const c_void, sel: *const c_void) -> *const c_void;
    #[link_name = "objc_msgSend"]
    fn send_err(obj: *const c_void, sel: *const c_void, err: *mut *const c_void) -> bool;
    #[link_name = "objc_msgSend"]
    fn send_int(obj: *const c_void, sel: *const c_void) -> i64;
}

pub fn available() -> bool {
    unsafe { !objc_getClass(b"SMAppService\0".as_ptr() as *const c_char).is_null() }
}

fn service() -> Option<*const c_void> {
    unsafe {
        let cls = objc_getClass(b"SMAppService\0".as_ptr() as *const c_char);
        if cls.is_null() {
            return None;
        }
        let svc = send0(
            cls,
            sel_registerName(b"mainAppService\0".as_ptr() as *const c_char),
        );
        (!svc.is_null()).then_some(svc)
    }
}

// SMAppServiceStatus: 0 notRegistered, 1 enabled, 2 requiresApproval
fn status(svc: *const c_void) -> i64 {
    unsafe { send_int(svc, sel_registerName(b"status\0".as_ptr() as *const c_char)) }
}

pub fn set_enabled(enable: bool) -> Result<(), String> {
    let svc = service().ok_or_else(|| "login items need macOS 13+".to_string())?;
    let name: &[u8] = if enable {
        b"registerAndReturnError:\0"
    } else {
        b"unregisterAndReturnError:\0"
    };
    unsafe {
        let mut err: *const c_void = std::ptr::null();
        let ok = send_err(
            svc,
            sel_registerName(name.as_ptr() as *const c_char),
            &mut err,
        );
        // "already in that state" counts as success — the goal is the
        // end state, not the transition. status 1 = enabled.
        let want: i64 = if enable { 1 } else { 0 };
        if ok || status(svc) == want {
            Ok(())
        } else {
            Err("login item request refused".into())
        }
    }
}
